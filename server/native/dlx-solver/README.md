# dlx-solver (Rust / N-API)

Сборка нативного модуля:

1) Установить Rust и npm/pnpm.
2) В каталоге `server/native/dlx-solver` выполнить:

```bash
pnpm add -D @napi-rs/cli
pnpm exec napi build --release
```

После сборки появится `index.node` в этом каталоге.

Использование из TS:
- В `solve` можно включить флаг `nativeDlx: true`.
- Для batch: `pnpm run fill-batch -- --native-dlx`.
- При необходимости можно указать путь через `DLX_NATIVE_PATH`.
