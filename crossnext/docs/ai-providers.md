AI Providers (generation)

Common env
- `AI_PROVIDER` — `nvidia` | `openai` | `anthropic` | `gemini` (по умолчанию `openai`)
- `AI_MODEL` — общее имя модели (можно переопределить провайдер-специфичным)
- `AI_REQUIRE_API_KEY` — `true|false` (по умолчанию true). Для локальных прокси можно выключить
- `AI_EXTRA_HEADERS` — JSON с доп. заголовками

NVIDIA NIM
- `AI_PROVIDER=nvidia`
- `NVIDIA_API_KEY`, опционально `NVIDIA_MODEL` (по умолчанию `google/gemma-3n-e4b-it`)
- `NVIDIA_BASE_URL` (по умолчанию `https://integrate.api.nvidia.com`)
- Путь: `NVIDIA_PATH` (по умолчанию `/v1/chat/completions`)
- Авторизация (опционально): `NVIDIA_AUTH_HEADER` (по умолчанию `Authorization`), `NVIDIA_AUTH_SCHEME` (по умолчанию `Bearer`)
- Параметры генерации (опционально):
  - `NVIDIA_TEMPERATURE` (по умолчанию `0.2`)
  - `NVIDIA_TOP_P` (по умолчанию `0.7`)
  - `NVIDIA_FREQUENCY_PENALTY` (по умолчанию `0`)
  - `NVIDIA_PRESENCE_PENALTY` (по умолчанию `0`)

OpenAI‑совместимые
- Ключ: `OPENAI_API_KEY` или `AI_API_KEY` (приоритет у `OPENAI_API_KEY`)
- База/путь: `OPENAI_BASE_URL` (или `AI_BASE_URL`), `AI_PATH` (по умолчанию `/v1/chat/completions`)
- Заголовок/схема авторизации: `AI_AUTH_HEADER` (по умолчанию `Authorization`), `AI_AUTH_SCHEME` (по умолчанию `Bearer`)

Anthropic (Claude)
- `AI_PROVIDER=anthropic`
- `ANTHROPIC_API_KEY`, опционально `ANTHROPIC_MODEL`, `ANTHROPIC_VERSION` (по умолчанию `2023-06-01`)

Google Gemini
- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`, опционально `GEMINI_MODEL`, `GEMINI_BASE_URL` (по умолчанию `https://generativelanguage.googleapis.com`)
- Путь: `GEMINI_PATH` (по умолчанию `/v1beta/models/<model>:generateContent`). Можно использовать плейсхолдер `<model>` — он будет заменён на имя модели.
- Если вместо `?key=` нужен заголовок — `GEMINI_AUTH_HEADER`

Примеры `.env.local`

NVIDIA (optional)
```
AI_PROVIDER=nvidia
NVIDIA_MODEL=google/gemma-3n-e4b-it
NVIDIA_API_KEY=nvapi-...
# NVIDIA_BASE_URL=https://integrate.api.nvidia.com
# NVIDIA_PATH=/v1/chat/completions
```

OpenAI
```
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=sk-...
# AI_BASE_URL=https://api.openai.com
# AI_PATH=/v1/chat/completions
```

Anthropic
```
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-20240620
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_VERSION=2023-06-01
```

Gemini
```
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=AIza...
# GEMINI_BASE_URL=https://generativelanguage.googleapis.com
# GEMINI_PATH=/v1beta/models/gemini-1.5-flash:generateContent
```

Подсказки по Gemini 2.x/2.5
- Некоторые новые модели могут требовать другой версионированный путь (например, `v1` вместо `v1beta`). В этом случае укажите `GEMINI_PATH`, используя плейсхолдер `<model>`:
  - `GEMINI_PATH=/v1/models/<model>:generateContent`
- Авторизацию можно передавать заголовком в стиле документации Google:
  - `GEMINI_AUTH_HEADER=x-goog-api-key`
- Чтобы убедиться, что имя модели верное для вашего ключа/проекта, получите список доступных моделей:
  - `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY" | jq -r '.models[].name'`
  - При заголовке: `curl -s -H "x-goog-api-key: YOUR_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | jq -r '.models[].name'`


Безопасность
- Не коммитить реальные ключи. Используйте `.env.local`
- Для CI/Prod — секреты через настройки окружения (Docker/Compose/Cloud)

## Word images in fill review

Photo slots offer **Generate image** using the current answer and selected definition. Generation is manual, one image per click. Existing uploads and image selection remain available. The generated image is selected immediately, saved in the word image library with `needsReview=true`, and fitted with white padding to the slot ratio without cutting off the subject. The operator must visually inspect it before finalizing.

- `OPENAI_API_KEY` — server-side key for both definitions and images (`AI_API_KEY` is a fallback).
- `OPENAI_MODEL` — definition model, default `gpt-4.1-mini`.
- `OPENAI_IMAGE_MODEL` — image model, default `gpt-image-1.5`.
- `OPENAI_IMAGE_MAX_EDGE` — maximum stored image edge in pixels, default `512` (128–2048). Dimensions preserve the exact slot ratio: 5:4 becomes 510×408, 1:1 becomes 512×512. OpenAI may return a larger source image; it is resized before saving.
- `OPENAI_IMAGE_TIMEOUT_MS` — image timeout, default `180000`, maximum `300000`.
- `OPENAI_BASE_URL` — optional OpenAI endpoint override; the Images API uses `/v1/images/generations` independently of `AI_PATH` and legacy provider settings.

The image endpoint is `POST /api/dictionary/word/:id/images/generate`, requires `DictionaryWrite`, and accepts `{ definition, targetWidth, targetHeight }` (slot dimensions in cells). It reads the answer from the database. Generation failures do not create images or mark the word as generated. Successful saves preserve an existing `imageGeneratedAt`. No database migration is needed.

For local model selection, edit `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL` and `OPENAI_IMAGE_MAX_EDGE` in `crossnext/.env`; keep `OPENAI_API_KEY` in `.env.local`. Restart the app after changing settings.

Definition prompts allow a new wording of an established meaning instead of forcing an invented new sense. Overlong, multiline, duplicate or answer-revealing results are rejected instead of being sliced mid-word.

API references: [OpenAI image generation](https://developers.openai.com/api/reference/resources/images/methods/generate), [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

OpenAI definition generation makes at most one correction attempt when the result violates output constraints; it never truncates the clue or retries quota errors.

The definition request sends the answer (`word`) and all supplied dictionary definitions (`existing`) as meaning context. Rejected or previously generated variants are passed separately in `avoid` and are excluded from output without becoming meaning context. For homonyms, the prompt asks for one established sense rather than combining unrelated meanings.

Newly generated images are named `<word>-<width>x<height>-<number>.png`, for example `иран-512x512-3.png`. Numbering is separate for each word and stored pixel size. Existing images of the same size count as versions; existing numbered suffixes are respected so gaps do not cause collisions. A database word-row lock serializes number allocation and saving across concurrent generation requests. Existing files keep their names.
