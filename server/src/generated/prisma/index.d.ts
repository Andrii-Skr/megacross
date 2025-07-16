
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model izd_name
 * 
 */
export type izd_name = $Result.DefaultSelection<Prisma.$izd_namePayload>
/**
 * Model number_izd
 * 
 */
export type number_izd = $Result.DefaultSelection<Prisma.$number_izdPayload>
/**
 * Model opred_v
 * 
 */
export type opred_v = $Result.DefaultSelection<Prisma.$opred_vPayload>
/**
 * Model publications
 * This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
 */
export type publications = $Result.DefaultSelection<Prisma.$publicationsPayload>
/**
 * Model shablon
 * 
 */
export type shablon = $Result.DefaultSelection<Prisma.$shablonPayload>
/**
 * Model shtat
 * 
 */
export type shtat = $Result.DefaultSelection<Prisma.$shtatPayload>
/**
 * Model tems
 * 
 */
export type tems = $Result.DefaultSelection<Prisma.$temsPayload>
/**
 * Model user
 * 
 */
export type user = $Result.DefaultSelection<Prisma.$userPayload>
/**
 * Model word_group
 * 
 */
export type word_group = $Result.DefaultSelection<Prisma.$word_groupPayload>
/**
 * Model words_v
 * 
 */
export type words_v = $Result.DefaultSelection<Prisma.$words_vPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Izd_names
 * const izd_names = await prisma.izd_name.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Izd_names
   * const izd_names = await prisma.izd_name.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.izd_name`: Exposes CRUD operations for the **izd_name** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Izd_names
    * const izd_names = await prisma.izd_name.findMany()
    * ```
    */
  get izd_name(): Prisma.izd_nameDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.number_izd`: Exposes CRUD operations for the **number_izd** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Number_izds
    * const number_izds = await prisma.number_izd.findMany()
    * ```
    */
  get number_izd(): Prisma.number_izdDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.opred_v`: Exposes CRUD operations for the **opred_v** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Opred_vs
    * const opred_vs = await prisma.opred_v.findMany()
    * ```
    */
  get opred_v(): Prisma.opred_vDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.publications`: Exposes CRUD operations for the **publications** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Publications
    * const publications = await prisma.publications.findMany()
    * ```
    */
  get publications(): Prisma.publicationsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.shablon`: Exposes CRUD operations for the **shablon** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Shablons
    * const shablons = await prisma.shablon.findMany()
    * ```
    */
  get shablon(): Prisma.shablonDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.shtat`: Exposes CRUD operations for the **shtat** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Shtats
    * const shtats = await prisma.shtat.findMany()
    * ```
    */
  get shtat(): Prisma.shtatDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tems`: Exposes CRUD operations for the **tems** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Tems
    * const tems = await prisma.tems.findMany()
    * ```
    */
  get tems(): Prisma.temsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **user** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.userDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.word_group`: Exposes CRUD operations for the **word_group** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Word_groups
    * const word_groups = await prisma.word_group.findMany()
    * ```
    */
  get word_group(): Prisma.word_groupDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.words_v`: Exposes CRUD operations for the **words_v** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Words_vs
    * const words_vs = await prisma.words_v.findMany()
    * ```
    */
  get words_v(): Prisma.words_vDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.11.1
   * Query Engine version: f40f79ec31188888a2e33acda0ecc8fd10a853a9
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    izd_name: 'izd_name',
    number_izd: 'number_izd',
    opred_v: 'opred_v',
    publications: 'publications',
    shablon: 'shablon',
    shtat: 'shtat',
    tems: 'tems',
    user: 'user',
    word_group: 'word_group',
    words_v: 'words_v'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "izd_name" | "number_izd" | "opred_v" | "publications" | "shablon" | "shtat" | "tems" | "user" | "word_group" | "words_v"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      izd_name: {
        payload: Prisma.$izd_namePayload<ExtArgs>
        fields: Prisma.izd_nameFieldRefs
        operations: {
          findUnique: {
            args: Prisma.izd_nameFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.izd_nameFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          findFirst: {
            args: Prisma.izd_nameFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.izd_nameFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          findMany: {
            args: Prisma.izd_nameFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>[]
          }
          create: {
            args: Prisma.izd_nameCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          createMany: {
            args: Prisma.izd_nameCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.izd_nameCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>[]
          }
          delete: {
            args: Prisma.izd_nameDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          update: {
            args: Prisma.izd_nameUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          deleteMany: {
            args: Prisma.izd_nameDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.izd_nameUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.izd_nameUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>[]
          }
          upsert: {
            args: Prisma.izd_nameUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$izd_namePayload>
          }
          aggregate: {
            args: Prisma.Izd_nameAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateIzd_name>
          }
          groupBy: {
            args: Prisma.izd_nameGroupByArgs<ExtArgs>
            result: $Utils.Optional<Izd_nameGroupByOutputType>[]
          }
          count: {
            args: Prisma.izd_nameCountArgs<ExtArgs>
            result: $Utils.Optional<Izd_nameCountAggregateOutputType> | number
          }
        }
      }
      number_izd: {
        payload: Prisma.$number_izdPayload<ExtArgs>
        fields: Prisma.number_izdFieldRefs
        operations: {
          findUnique: {
            args: Prisma.number_izdFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.number_izdFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          findFirst: {
            args: Prisma.number_izdFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.number_izdFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          findMany: {
            args: Prisma.number_izdFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>[]
          }
          create: {
            args: Prisma.number_izdCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          createMany: {
            args: Prisma.number_izdCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.number_izdCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>[]
          }
          delete: {
            args: Prisma.number_izdDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          update: {
            args: Prisma.number_izdUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          deleteMany: {
            args: Prisma.number_izdDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.number_izdUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.number_izdUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>[]
          }
          upsert: {
            args: Prisma.number_izdUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$number_izdPayload>
          }
          aggregate: {
            args: Prisma.Number_izdAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateNumber_izd>
          }
          groupBy: {
            args: Prisma.number_izdGroupByArgs<ExtArgs>
            result: $Utils.Optional<Number_izdGroupByOutputType>[]
          }
          count: {
            args: Prisma.number_izdCountArgs<ExtArgs>
            result: $Utils.Optional<Number_izdCountAggregateOutputType> | number
          }
        }
      }
      opred_v: {
        payload: Prisma.$opred_vPayload<ExtArgs>
        fields: Prisma.opred_vFieldRefs
        operations: {
          findUnique: {
            args: Prisma.opred_vFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.opred_vFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          findFirst: {
            args: Prisma.opred_vFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.opred_vFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          findMany: {
            args: Prisma.opred_vFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>[]
          }
          create: {
            args: Prisma.opred_vCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          createMany: {
            args: Prisma.opred_vCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.opred_vCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>[]
          }
          delete: {
            args: Prisma.opred_vDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          update: {
            args: Prisma.opred_vUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          deleteMany: {
            args: Prisma.opred_vDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.opred_vUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.opred_vUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>[]
          }
          upsert: {
            args: Prisma.opred_vUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$opred_vPayload>
          }
          aggregate: {
            args: Prisma.Opred_vAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOpred_v>
          }
          groupBy: {
            args: Prisma.opred_vGroupByArgs<ExtArgs>
            result: $Utils.Optional<Opred_vGroupByOutputType>[]
          }
          count: {
            args: Prisma.opred_vCountArgs<ExtArgs>
            result: $Utils.Optional<Opred_vCountAggregateOutputType> | number
          }
        }
      }
      publications: {
        payload: Prisma.$publicationsPayload<ExtArgs>
        fields: Prisma.publicationsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.publicationsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.publicationsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          findFirst: {
            args: Prisma.publicationsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.publicationsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          findMany: {
            args: Prisma.publicationsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>[]
          }
          create: {
            args: Prisma.publicationsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          createMany: {
            args: Prisma.publicationsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.publicationsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>[]
          }
          delete: {
            args: Prisma.publicationsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          update: {
            args: Prisma.publicationsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          deleteMany: {
            args: Prisma.publicationsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.publicationsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.publicationsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>[]
          }
          upsert: {
            args: Prisma.publicationsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$publicationsPayload>
          }
          aggregate: {
            args: Prisma.PublicationsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePublications>
          }
          groupBy: {
            args: Prisma.publicationsGroupByArgs<ExtArgs>
            result: $Utils.Optional<PublicationsGroupByOutputType>[]
          }
          count: {
            args: Prisma.publicationsCountArgs<ExtArgs>
            result: $Utils.Optional<PublicationsCountAggregateOutputType> | number
          }
        }
      }
      shablon: {
        payload: Prisma.$shablonPayload<ExtArgs>
        fields: Prisma.shablonFieldRefs
        operations: {
          findUnique: {
            args: Prisma.shablonFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.shablonFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          findFirst: {
            args: Prisma.shablonFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.shablonFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          findMany: {
            args: Prisma.shablonFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>[]
          }
          create: {
            args: Prisma.shablonCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          createMany: {
            args: Prisma.shablonCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.shablonCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>[]
          }
          delete: {
            args: Prisma.shablonDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          update: {
            args: Prisma.shablonUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          deleteMany: {
            args: Prisma.shablonDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.shablonUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.shablonUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>[]
          }
          upsert: {
            args: Prisma.shablonUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shablonPayload>
          }
          aggregate: {
            args: Prisma.ShablonAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateShablon>
          }
          groupBy: {
            args: Prisma.shablonGroupByArgs<ExtArgs>
            result: $Utils.Optional<ShablonGroupByOutputType>[]
          }
          count: {
            args: Prisma.shablonCountArgs<ExtArgs>
            result: $Utils.Optional<ShablonCountAggregateOutputType> | number
          }
        }
      }
      shtat: {
        payload: Prisma.$shtatPayload<ExtArgs>
        fields: Prisma.shtatFieldRefs
        operations: {
          findUnique: {
            args: Prisma.shtatFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.shtatFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          findFirst: {
            args: Prisma.shtatFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.shtatFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          findMany: {
            args: Prisma.shtatFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>[]
          }
          create: {
            args: Prisma.shtatCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          createMany: {
            args: Prisma.shtatCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.shtatCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>[]
          }
          delete: {
            args: Prisma.shtatDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          update: {
            args: Prisma.shtatUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          deleteMany: {
            args: Prisma.shtatDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.shtatUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.shtatUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>[]
          }
          upsert: {
            args: Prisma.shtatUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$shtatPayload>
          }
          aggregate: {
            args: Prisma.ShtatAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateShtat>
          }
          groupBy: {
            args: Prisma.shtatGroupByArgs<ExtArgs>
            result: $Utils.Optional<ShtatGroupByOutputType>[]
          }
          count: {
            args: Prisma.shtatCountArgs<ExtArgs>
            result: $Utils.Optional<ShtatCountAggregateOutputType> | number
          }
        }
      }
      tems: {
        payload: Prisma.$temsPayload<ExtArgs>
        fields: Prisma.temsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.temsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.temsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          findFirst: {
            args: Prisma.temsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.temsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          findMany: {
            args: Prisma.temsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>[]
          }
          create: {
            args: Prisma.temsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          createMany: {
            args: Prisma.temsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.temsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>[]
          }
          delete: {
            args: Prisma.temsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          update: {
            args: Prisma.temsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          deleteMany: {
            args: Prisma.temsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.temsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.temsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>[]
          }
          upsert: {
            args: Prisma.temsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$temsPayload>
          }
          aggregate: {
            args: Prisma.TemsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTems>
          }
          groupBy: {
            args: Prisma.temsGroupByArgs<ExtArgs>
            result: $Utils.Optional<TemsGroupByOutputType>[]
          }
          count: {
            args: Prisma.temsCountArgs<ExtArgs>
            result: $Utils.Optional<TemsCountAggregateOutputType> | number
          }
        }
      }
      user: {
        payload: Prisma.$userPayload<ExtArgs>
        fields: Prisma.userFieldRefs
        operations: {
          findUnique: {
            args: Prisma.userFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.userFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          findFirst: {
            args: Prisma.userFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.userFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          findMany: {
            args: Prisma.userFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>[]
          }
          create: {
            args: Prisma.userCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          createMany: {
            args: Prisma.userCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.userCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>[]
          }
          delete: {
            args: Prisma.userDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          update: {
            args: Prisma.userUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          deleteMany: {
            args: Prisma.userDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.userUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.userUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>[]
          }
          upsert: {
            args: Prisma.userUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$userPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.userGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.userCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      word_group: {
        payload: Prisma.$word_groupPayload<ExtArgs>
        fields: Prisma.word_groupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.word_groupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.word_groupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          findFirst: {
            args: Prisma.word_groupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.word_groupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          findMany: {
            args: Prisma.word_groupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>[]
          }
          create: {
            args: Prisma.word_groupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          createMany: {
            args: Prisma.word_groupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.word_groupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>[]
          }
          delete: {
            args: Prisma.word_groupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          update: {
            args: Prisma.word_groupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          deleteMany: {
            args: Prisma.word_groupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.word_groupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.word_groupUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>[]
          }
          upsert: {
            args: Prisma.word_groupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$word_groupPayload>
          }
          aggregate: {
            args: Prisma.Word_groupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWord_group>
          }
          groupBy: {
            args: Prisma.word_groupGroupByArgs<ExtArgs>
            result: $Utils.Optional<Word_groupGroupByOutputType>[]
          }
          count: {
            args: Prisma.word_groupCountArgs<ExtArgs>
            result: $Utils.Optional<Word_groupCountAggregateOutputType> | number
          }
        }
      }
      words_v: {
        payload: Prisma.$words_vPayload<ExtArgs>
        fields: Prisma.words_vFieldRefs
        operations: {
          findUnique: {
            args: Prisma.words_vFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.words_vFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          findFirst: {
            args: Prisma.words_vFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.words_vFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          findMany: {
            args: Prisma.words_vFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>[]
          }
          create: {
            args: Prisma.words_vCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          createMany: {
            args: Prisma.words_vCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.words_vCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>[]
          }
          delete: {
            args: Prisma.words_vDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          update: {
            args: Prisma.words_vUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          deleteMany: {
            args: Prisma.words_vDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.words_vUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.words_vUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>[]
          }
          upsert: {
            args: Prisma.words_vUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$words_vPayload>
          }
          aggregate: {
            args: Prisma.Words_vAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWords_v>
          }
          groupBy: {
            args: Prisma.words_vGroupByArgs<ExtArgs>
            result: $Utils.Optional<Words_vGroupByOutputType>[]
          }
          count: {
            args: Prisma.words_vCountArgs<ExtArgs>
            result: $Utils.Optional<Words_vCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    izd_name?: izd_nameOmit
    number_izd?: number_izdOmit
    opred_v?: opred_vOmit
    publications?: publicationsOmit
    shablon?: shablonOmit
    shtat?: shtatOmit
    tems?: temsOmit
    user?: userOmit
    word_group?: word_groupOmit
    words_v?: words_vOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model izd_name
   */

  export type AggregateIzd_name = {
    _count: Izd_nameCountAggregateOutputType | null
    _avg: Izd_nameAvgAggregateOutputType | null
    _sum: Izd_nameSumAggregateOutputType | null
    _min: Izd_nameMinAggregateOutputType | null
    _max: Izd_nameMaxAggregateOutputType | null
  }

  export type Izd_nameAvgAggregateOutputType = {
    id: number | null
  }

  export type Izd_nameSumAggregateOutputType = {
    id: bigint | null
  }

  export type Izd_nameMinAggregateOutputType = {
    id: bigint | null
    name: string | null
    redakcia: string | null
    tabl_name: string | null
    add_user: string | null
    add_data: Date | null
  }

  export type Izd_nameMaxAggregateOutputType = {
    id: bigint | null
    name: string | null
    redakcia: string | null
    tabl_name: string | null
    add_user: string | null
    add_data: Date | null
  }

  export type Izd_nameCountAggregateOutputType = {
    id: number
    name: number
    redakcia: number
    tabl_name: number
    add_user: number
    add_data: number
    _all: number
  }


  export type Izd_nameAvgAggregateInputType = {
    id?: true
  }

  export type Izd_nameSumAggregateInputType = {
    id?: true
  }

  export type Izd_nameMinAggregateInputType = {
    id?: true
    name?: true
    redakcia?: true
    tabl_name?: true
    add_user?: true
    add_data?: true
  }

  export type Izd_nameMaxAggregateInputType = {
    id?: true
    name?: true
    redakcia?: true
    tabl_name?: true
    add_user?: true
    add_data?: true
  }

  export type Izd_nameCountAggregateInputType = {
    id?: true
    name?: true
    redakcia?: true
    tabl_name?: true
    add_user?: true
    add_data?: true
    _all?: true
  }

  export type Izd_nameAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which izd_name to aggregate.
     */
    where?: izd_nameWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of izd_names to fetch.
     */
    orderBy?: izd_nameOrderByWithRelationInput | izd_nameOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: izd_nameWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` izd_names from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` izd_names.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned izd_names
    **/
    _count?: true | Izd_nameCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Izd_nameAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Izd_nameSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Izd_nameMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Izd_nameMaxAggregateInputType
  }

  export type GetIzd_nameAggregateType<T extends Izd_nameAggregateArgs> = {
        [P in keyof T & keyof AggregateIzd_name]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateIzd_name[P]>
      : GetScalarType<T[P], AggregateIzd_name[P]>
  }




  export type izd_nameGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: izd_nameWhereInput
    orderBy?: izd_nameOrderByWithAggregationInput | izd_nameOrderByWithAggregationInput[]
    by: Izd_nameScalarFieldEnum[] | Izd_nameScalarFieldEnum
    having?: izd_nameScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Izd_nameCountAggregateInputType | true
    _avg?: Izd_nameAvgAggregateInputType
    _sum?: Izd_nameSumAggregateInputType
    _min?: Izd_nameMinAggregateInputType
    _max?: Izd_nameMaxAggregateInputType
  }

  export type Izd_nameGroupByOutputType = {
    id: bigint
    name: string
    redakcia: string
    tabl_name: string
    add_user: string
    add_data: Date | null
    _count: Izd_nameCountAggregateOutputType | null
    _avg: Izd_nameAvgAggregateOutputType | null
    _sum: Izd_nameSumAggregateOutputType | null
    _min: Izd_nameMinAggregateOutputType | null
    _max: Izd_nameMaxAggregateOutputType | null
  }

  type GetIzd_nameGroupByPayload<T extends izd_nameGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Izd_nameGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Izd_nameGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Izd_nameGroupByOutputType[P]>
            : GetScalarType<T[P], Izd_nameGroupByOutputType[P]>
        }
      >
    >


  export type izd_nameSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    redakcia?: boolean
    tabl_name?: boolean
    add_user?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["izd_name"]>

  export type izd_nameSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    redakcia?: boolean
    tabl_name?: boolean
    add_user?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["izd_name"]>

  export type izd_nameSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    redakcia?: boolean
    tabl_name?: boolean
    add_user?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["izd_name"]>

  export type izd_nameSelectScalar = {
    id?: boolean
    name?: boolean
    redakcia?: boolean
    tabl_name?: boolean
    add_user?: boolean
    add_data?: boolean
  }

  export type izd_nameOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "redakcia" | "tabl_name" | "add_user" | "add_data", ExtArgs["result"]["izd_name"]>

  export type $izd_namePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "izd_name"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      name: string
      redakcia: string
      tabl_name: string
      add_user: string
      add_data: Date | null
    }, ExtArgs["result"]["izd_name"]>
    composites: {}
  }

  type izd_nameGetPayload<S extends boolean | null | undefined | izd_nameDefaultArgs> = $Result.GetResult<Prisma.$izd_namePayload, S>

  type izd_nameCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<izd_nameFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Izd_nameCountAggregateInputType | true
    }

  export interface izd_nameDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['izd_name'], meta: { name: 'izd_name' } }
    /**
     * Find zero or one Izd_name that matches the filter.
     * @param {izd_nameFindUniqueArgs} args - Arguments to find a Izd_name
     * @example
     * // Get one Izd_name
     * const izd_name = await prisma.izd_name.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends izd_nameFindUniqueArgs>(args: SelectSubset<T, izd_nameFindUniqueArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Izd_name that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {izd_nameFindUniqueOrThrowArgs} args - Arguments to find a Izd_name
     * @example
     * // Get one Izd_name
     * const izd_name = await prisma.izd_name.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends izd_nameFindUniqueOrThrowArgs>(args: SelectSubset<T, izd_nameFindUniqueOrThrowArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Izd_name that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameFindFirstArgs} args - Arguments to find a Izd_name
     * @example
     * // Get one Izd_name
     * const izd_name = await prisma.izd_name.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends izd_nameFindFirstArgs>(args?: SelectSubset<T, izd_nameFindFirstArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Izd_name that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameFindFirstOrThrowArgs} args - Arguments to find a Izd_name
     * @example
     * // Get one Izd_name
     * const izd_name = await prisma.izd_name.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends izd_nameFindFirstOrThrowArgs>(args?: SelectSubset<T, izd_nameFindFirstOrThrowArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Izd_names that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Izd_names
     * const izd_names = await prisma.izd_name.findMany()
     * 
     * // Get first 10 Izd_names
     * const izd_names = await prisma.izd_name.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const izd_nameWithIdOnly = await prisma.izd_name.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends izd_nameFindManyArgs>(args?: SelectSubset<T, izd_nameFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Izd_name.
     * @param {izd_nameCreateArgs} args - Arguments to create a Izd_name.
     * @example
     * // Create one Izd_name
     * const Izd_name = await prisma.izd_name.create({
     *   data: {
     *     // ... data to create a Izd_name
     *   }
     * })
     * 
     */
    create<T extends izd_nameCreateArgs>(args: SelectSubset<T, izd_nameCreateArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Izd_names.
     * @param {izd_nameCreateManyArgs} args - Arguments to create many Izd_names.
     * @example
     * // Create many Izd_names
     * const izd_name = await prisma.izd_name.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends izd_nameCreateManyArgs>(args?: SelectSubset<T, izd_nameCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Izd_names and returns the data saved in the database.
     * @param {izd_nameCreateManyAndReturnArgs} args - Arguments to create many Izd_names.
     * @example
     * // Create many Izd_names
     * const izd_name = await prisma.izd_name.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Izd_names and only return the `id`
     * const izd_nameWithIdOnly = await prisma.izd_name.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends izd_nameCreateManyAndReturnArgs>(args?: SelectSubset<T, izd_nameCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Izd_name.
     * @param {izd_nameDeleteArgs} args - Arguments to delete one Izd_name.
     * @example
     * // Delete one Izd_name
     * const Izd_name = await prisma.izd_name.delete({
     *   where: {
     *     // ... filter to delete one Izd_name
     *   }
     * })
     * 
     */
    delete<T extends izd_nameDeleteArgs>(args: SelectSubset<T, izd_nameDeleteArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Izd_name.
     * @param {izd_nameUpdateArgs} args - Arguments to update one Izd_name.
     * @example
     * // Update one Izd_name
     * const izd_name = await prisma.izd_name.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends izd_nameUpdateArgs>(args: SelectSubset<T, izd_nameUpdateArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Izd_names.
     * @param {izd_nameDeleteManyArgs} args - Arguments to filter Izd_names to delete.
     * @example
     * // Delete a few Izd_names
     * const { count } = await prisma.izd_name.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends izd_nameDeleteManyArgs>(args?: SelectSubset<T, izd_nameDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Izd_names.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Izd_names
     * const izd_name = await prisma.izd_name.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends izd_nameUpdateManyArgs>(args: SelectSubset<T, izd_nameUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Izd_names and returns the data updated in the database.
     * @param {izd_nameUpdateManyAndReturnArgs} args - Arguments to update many Izd_names.
     * @example
     * // Update many Izd_names
     * const izd_name = await prisma.izd_name.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Izd_names and only return the `id`
     * const izd_nameWithIdOnly = await prisma.izd_name.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends izd_nameUpdateManyAndReturnArgs>(args: SelectSubset<T, izd_nameUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Izd_name.
     * @param {izd_nameUpsertArgs} args - Arguments to update or create a Izd_name.
     * @example
     * // Update or create a Izd_name
     * const izd_name = await prisma.izd_name.upsert({
     *   create: {
     *     // ... data to create a Izd_name
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Izd_name we want to update
     *   }
     * })
     */
    upsert<T extends izd_nameUpsertArgs>(args: SelectSubset<T, izd_nameUpsertArgs<ExtArgs>>): Prisma__izd_nameClient<$Result.GetResult<Prisma.$izd_namePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Izd_names.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameCountArgs} args - Arguments to filter Izd_names to count.
     * @example
     * // Count the number of Izd_names
     * const count = await prisma.izd_name.count({
     *   where: {
     *     // ... the filter for the Izd_names we want to count
     *   }
     * })
    **/
    count<T extends izd_nameCountArgs>(
      args?: Subset<T, izd_nameCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Izd_nameCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Izd_name.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Izd_nameAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Izd_nameAggregateArgs>(args: Subset<T, Izd_nameAggregateArgs>): Prisma.PrismaPromise<GetIzd_nameAggregateType<T>>

    /**
     * Group by Izd_name.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {izd_nameGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends izd_nameGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: izd_nameGroupByArgs['orderBy'] }
        : { orderBy?: izd_nameGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, izd_nameGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetIzd_nameGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the izd_name model
   */
  readonly fields: izd_nameFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for izd_name.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__izd_nameClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the izd_name model
   */
  interface izd_nameFieldRefs {
    readonly id: FieldRef<"izd_name", 'BigInt'>
    readonly name: FieldRef<"izd_name", 'String'>
    readonly redakcia: FieldRef<"izd_name", 'String'>
    readonly tabl_name: FieldRef<"izd_name", 'String'>
    readonly add_user: FieldRef<"izd_name", 'String'>
    readonly add_data: FieldRef<"izd_name", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * izd_name findUnique
   */
  export type izd_nameFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter, which izd_name to fetch.
     */
    where: izd_nameWhereUniqueInput
  }

  /**
   * izd_name findUniqueOrThrow
   */
  export type izd_nameFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter, which izd_name to fetch.
     */
    where: izd_nameWhereUniqueInput
  }

  /**
   * izd_name findFirst
   */
  export type izd_nameFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter, which izd_name to fetch.
     */
    where?: izd_nameWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of izd_names to fetch.
     */
    orderBy?: izd_nameOrderByWithRelationInput | izd_nameOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for izd_names.
     */
    cursor?: izd_nameWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` izd_names from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` izd_names.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of izd_names.
     */
    distinct?: Izd_nameScalarFieldEnum | Izd_nameScalarFieldEnum[]
  }

  /**
   * izd_name findFirstOrThrow
   */
  export type izd_nameFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter, which izd_name to fetch.
     */
    where?: izd_nameWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of izd_names to fetch.
     */
    orderBy?: izd_nameOrderByWithRelationInput | izd_nameOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for izd_names.
     */
    cursor?: izd_nameWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` izd_names from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` izd_names.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of izd_names.
     */
    distinct?: Izd_nameScalarFieldEnum | Izd_nameScalarFieldEnum[]
  }

  /**
   * izd_name findMany
   */
  export type izd_nameFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter, which izd_names to fetch.
     */
    where?: izd_nameWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of izd_names to fetch.
     */
    orderBy?: izd_nameOrderByWithRelationInput | izd_nameOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing izd_names.
     */
    cursor?: izd_nameWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` izd_names from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` izd_names.
     */
    skip?: number
    distinct?: Izd_nameScalarFieldEnum | Izd_nameScalarFieldEnum[]
  }

  /**
   * izd_name create
   */
  export type izd_nameCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * The data needed to create a izd_name.
     */
    data: XOR<izd_nameCreateInput, izd_nameUncheckedCreateInput>
  }

  /**
   * izd_name createMany
   */
  export type izd_nameCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many izd_names.
     */
    data: izd_nameCreateManyInput | izd_nameCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * izd_name createManyAndReturn
   */
  export type izd_nameCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * The data used to create many izd_names.
     */
    data: izd_nameCreateManyInput | izd_nameCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * izd_name update
   */
  export type izd_nameUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * The data needed to update a izd_name.
     */
    data: XOR<izd_nameUpdateInput, izd_nameUncheckedUpdateInput>
    /**
     * Choose, which izd_name to update.
     */
    where: izd_nameWhereUniqueInput
  }

  /**
   * izd_name updateMany
   */
  export type izd_nameUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update izd_names.
     */
    data: XOR<izd_nameUpdateManyMutationInput, izd_nameUncheckedUpdateManyInput>
    /**
     * Filter which izd_names to update
     */
    where?: izd_nameWhereInput
    /**
     * Limit how many izd_names to update.
     */
    limit?: number
  }

  /**
   * izd_name updateManyAndReturn
   */
  export type izd_nameUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * The data used to update izd_names.
     */
    data: XOR<izd_nameUpdateManyMutationInput, izd_nameUncheckedUpdateManyInput>
    /**
     * Filter which izd_names to update
     */
    where?: izd_nameWhereInput
    /**
     * Limit how many izd_names to update.
     */
    limit?: number
  }

  /**
   * izd_name upsert
   */
  export type izd_nameUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * The filter to search for the izd_name to update in case it exists.
     */
    where: izd_nameWhereUniqueInput
    /**
     * In case the izd_name found by the `where` argument doesn't exist, create a new izd_name with this data.
     */
    create: XOR<izd_nameCreateInput, izd_nameUncheckedCreateInput>
    /**
     * In case the izd_name was found with the provided `where` argument, update it with this data.
     */
    update: XOR<izd_nameUpdateInput, izd_nameUncheckedUpdateInput>
  }

  /**
   * izd_name delete
   */
  export type izd_nameDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
    /**
     * Filter which izd_name to delete.
     */
    where: izd_nameWhereUniqueInput
  }

  /**
   * izd_name deleteMany
   */
  export type izd_nameDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which izd_names to delete
     */
    where?: izd_nameWhereInput
    /**
     * Limit how many izd_names to delete.
     */
    limit?: number
  }

  /**
   * izd_name without action
   */
  export type izd_nameDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the izd_name
     */
    select?: izd_nameSelect<ExtArgs> | null
    /**
     * Omit specific fields from the izd_name
     */
    omit?: izd_nameOmit<ExtArgs> | null
  }


  /**
   * Model number_izd
   */

  export type AggregateNumber_izd = {
    _count: Number_izdCountAggregateOutputType | null
    _avg: Number_izdAvgAggregateOutputType | null
    _sum: Number_izdSumAggregateOutputType | null
    _min: Number_izdMinAggregateOutputType | null
    _max: Number_izdMaxAggregateOutputType | null
  }

  export type Number_izdAvgAggregateOutputType = {
    id: number | null
    izd_id: number | null
    curent_id: number | null
  }

  export type Number_izdSumAggregateOutputType = {
    id: bigint | null
    izd_id: bigint | null
    curent_id: bigint | null
  }

  export type Number_izdMinAggregateOutputType = {
    id: bigint | null
    izd_id: bigint | null
    curent_id: bigint | null
    pub_numb: string | null
  }

  export type Number_izdMaxAggregateOutputType = {
    id: bigint | null
    izd_id: bigint | null
    curent_id: bigint | null
    pub_numb: string | null
  }

  export type Number_izdCountAggregateOutputType = {
    id: number
    izd_id: number
    curent_id: number
    pub_numb: number
    _all: number
  }


  export type Number_izdAvgAggregateInputType = {
    id?: true
    izd_id?: true
    curent_id?: true
  }

  export type Number_izdSumAggregateInputType = {
    id?: true
    izd_id?: true
    curent_id?: true
  }

  export type Number_izdMinAggregateInputType = {
    id?: true
    izd_id?: true
    curent_id?: true
    pub_numb?: true
  }

  export type Number_izdMaxAggregateInputType = {
    id?: true
    izd_id?: true
    curent_id?: true
    pub_numb?: true
  }

  export type Number_izdCountAggregateInputType = {
    id?: true
    izd_id?: true
    curent_id?: true
    pub_numb?: true
    _all?: true
  }

  export type Number_izdAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which number_izd to aggregate.
     */
    where?: number_izdWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of number_izds to fetch.
     */
    orderBy?: number_izdOrderByWithRelationInput | number_izdOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: number_izdWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` number_izds from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` number_izds.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned number_izds
    **/
    _count?: true | Number_izdCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Number_izdAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Number_izdSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Number_izdMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Number_izdMaxAggregateInputType
  }

  export type GetNumber_izdAggregateType<T extends Number_izdAggregateArgs> = {
        [P in keyof T & keyof AggregateNumber_izd]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateNumber_izd[P]>
      : GetScalarType<T[P], AggregateNumber_izd[P]>
  }




  export type number_izdGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: number_izdWhereInput
    orderBy?: number_izdOrderByWithAggregationInput | number_izdOrderByWithAggregationInput[]
    by: Number_izdScalarFieldEnum[] | Number_izdScalarFieldEnum
    having?: number_izdScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Number_izdCountAggregateInputType | true
    _avg?: Number_izdAvgAggregateInputType
    _sum?: Number_izdSumAggregateInputType
    _min?: Number_izdMinAggregateInputType
    _max?: Number_izdMaxAggregateInputType
  }

  export type Number_izdGroupByOutputType = {
    id: bigint
    izd_id: bigint
    curent_id: bigint
    pub_numb: string
    _count: Number_izdCountAggregateOutputType | null
    _avg: Number_izdAvgAggregateOutputType | null
    _sum: Number_izdSumAggregateOutputType | null
    _min: Number_izdMinAggregateOutputType | null
    _max: Number_izdMaxAggregateOutputType | null
  }

  type GetNumber_izdGroupByPayload<T extends number_izdGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Number_izdGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Number_izdGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Number_izdGroupByOutputType[P]>
            : GetScalarType<T[P], Number_izdGroupByOutputType[P]>
        }
      >
    >


  export type number_izdSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    izd_id?: boolean
    curent_id?: boolean
    pub_numb?: boolean
  }, ExtArgs["result"]["number_izd"]>

  export type number_izdSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    izd_id?: boolean
    curent_id?: boolean
    pub_numb?: boolean
  }, ExtArgs["result"]["number_izd"]>

  export type number_izdSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    izd_id?: boolean
    curent_id?: boolean
    pub_numb?: boolean
  }, ExtArgs["result"]["number_izd"]>

  export type number_izdSelectScalar = {
    id?: boolean
    izd_id?: boolean
    curent_id?: boolean
    pub_numb?: boolean
  }

  export type number_izdOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "izd_id" | "curent_id" | "pub_numb", ExtArgs["result"]["number_izd"]>

  export type $number_izdPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "number_izd"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      izd_id: bigint
      curent_id: bigint
      pub_numb: string
    }, ExtArgs["result"]["number_izd"]>
    composites: {}
  }

  type number_izdGetPayload<S extends boolean | null | undefined | number_izdDefaultArgs> = $Result.GetResult<Prisma.$number_izdPayload, S>

  type number_izdCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<number_izdFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Number_izdCountAggregateInputType | true
    }

  export interface number_izdDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['number_izd'], meta: { name: 'number_izd' } }
    /**
     * Find zero or one Number_izd that matches the filter.
     * @param {number_izdFindUniqueArgs} args - Arguments to find a Number_izd
     * @example
     * // Get one Number_izd
     * const number_izd = await prisma.number_izd.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends number_izdFindUniqueArgs>(args: SelectSubset<T, number_izdFindUniqueArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Number_izd that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {number_izdFindUniqueOrThrowArgs} args - Arguments to find a Number_izd
     * @example
     * // Get one Number_izd
     * const number_izd = await prisma.number_izd.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends number_izdFindUniqueOrThrowArgs>(args: SelectSubset<T, number_izdFindUniqueOrThrowArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Number_izd that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdFindFirstArgs} args - Arguments to find a Number_izd
     * @example
     * // Get one Number_izd
     * const number_izd = await prisma.number_izd.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends number_izdFindFirstArgs>(args?: SelectSubset<T, number_izdFindFirstArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Number_izd that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdFindFirstOrThrowArgs} args - Arguments to find a Number_izd
     * @example
     * // Get one Number_izd
     * const number_izd = await prisma.number_izd.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends number_izdFindFirstOrThrowArgs>(args?: SelectSubset<T, number_izdFindFirstOrThrowArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Number_izds that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Number_izds
     * const number_izds = await prisma.number_izd.findMany()
     * 
     * // Get first 10 Number_izds
     * const number_izds = await prisma.number_izd.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const number_izdWithIdOnly = await prisma.number_izd.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends number_izdFindManyArgs>(args?: SelectSubset<T, number_izdFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Number_izd.
     * @param {number_izdCreateArgs} args - Arguments to create a Number_izd.
     * @example
     * // Create one Number_izd
     * const Number_izd = await prisma.number_izd.create({
     *   data: {
     *     // ... data to create a Number_izd
     *   }
     * })
     * 
     */
    create<T extends number_izdCreateArgs>(args: SelectSubset<T, number_izdCreateArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Number_izds.
     * @param {number_izdCreateManyArgs} args - Arguments to create many Number_izds.
     * @example
     * // Create many Number_izds
     * const number_izd = await prisma.number_izd.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends number_izdCreateManyArgs>(args?: SelectSubset<T, number_izdCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Number_izds and returns the data saved in the database.
     * @param {number_izdCreateManyAndReturnArgs} args - Arguments to create many Number_izds.
     * @example
     * // Create many Number_izds
     * const number_izd = await prisma.number_izd.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Number_izds and only return the `id`
     * const number_izdWithIdOnly = await prisma.number_izd.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends number_izdCreateManyAndReturnArgs>(args?: SelectSubset<T, number_izdCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Number_izd.
     * @param {number_izdDeleteArgs} args - Arguments to delete one Number_izd.
     * @example
     * // Delete one Number_izd
     * const Number_izd = await prisma.number_izd.delete({
     *   where: {
     *     // ... filter to delete one Number_izd
     *   }
     * })
     * 
     */
    delete<T extends number_izdDeleteArgs>(args: SelectSubset<T, number_izdDeleteArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Number_izd.
     * @param {number_izdUpdateArgs} args - Arguments to update one Number_izd.
     * @example
     * // Update one Number_izd
     * const number_izd = await prisma.number_izd.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends number_izdUpdateArgs>(args: SelectSubset<T, number_izdUpdateArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Number_izds.
     * @param {number_izdDeleteManyArgs} args - Arguments to filter Number_izds to delete.
     * @example
     * // Delete a few Number_izds
     * const { count } = await prisma.number_izd.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends number_izdDeleteManyArgs>(args?: SelectSubset<T, number_izdDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Number_izds.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Number_izds
     * const number_izd = await prisma.number_izd.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends number_izdUpdateManyArgs>(args: SelectSubset<T, number_izdUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Number_izds and returns the data updated in the database.
     * @param {number_izdUpdateManyAndReturnArgs} args - Arguments to update many Number_izds.
     * @example
     * // Update many Number_izds
     * const number_izd = await prisma.number_izd.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Number_izds and only return the `id`
     * const number_izdWithIdOnly = await prisma.number_izd.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends number_izdUpdateManyAndReturnArgs>(args: SelectSubset<T, number_izdUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Number_izd.
     * @param {number_izdUpsertArgs} args - Arguments to update or create a Number_izd.
     * @example
     * // Update or create a Number_izd
     * const number_izd = await prisma.number_izd.upsert({
     *   create: {
     *     // ... data to create a Number_izd
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Number_izd we want to update
     *   }
     * })
     */
    upsert<T extends number_izdUpsertArgs>(args: SelectSubset<T, number_izdUpsertArgs<ExtArgs>>): Prisma__number_izdClient<$Result.GetResult<Prisma.$number_izdPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Number_izds.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdCountArgs} args - Arguments to filter Number_izds to count.
     * @example
     * // Count the number of Number_izds
     * const count = await prisma.number_izd.count({
     *   where: {
     *     // ... the filter for the Number_izds we want to count
     *   }
     * })
    **/
    count<T extends number_izdCountArgs>(
      args?: Subset<T, number_izdCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Number_izdCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Number_izd.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Number_izdAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Number_izdAggregateArgs>(args: Subset<T, Number_izdAggregateArgs>): Prisma.PrismaPromise<GetNumber_izdAggregateType<T>>

    /**
     * Group by Number_izd.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {number_izdGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends number_izdGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: number_izdGroupByArgs['orderBy'] }
        : { orderBy?: number_izdGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, number_izdGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetNumber_izdGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the number_izd model
   */
  readonly fields: number_izdFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for number_izd.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__number_izdClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the number_izd model
   */
  interface number_izdFieldRefs {
    readonly id: FieldRef<"number_izd", 'BigInt'>
    readonly izd_id: FieldRef<"number_izd", 'BigInt'>
    readonly curent_id: FieldRef<"number_izd", 'BigInt'>
    readonly pub_numb: FieldRef<"number_izd", 'String'>
  }
    

  // Custom InputTypes
  /**
   * number_izd findUnique
   */
  export type number_izdFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter, which number_izd to fetch.
     */
    where: number_izdWhereUniqueInput
  }

  /**
   * number_izd findUniqueOrThrow
   */
  export type number_izdFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter, which number_izd to fetch.
     */
    where: number_izdWhereUniqueInput
  }

  /**
   * number_izd findFirst
   */
  export type number_izdFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter, which number_izd to fetch.
     */
    where?: number_izdWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of number_izds to fetch.
     */
    orderBy?: number_izdOrderByWithRelationInput | number_izdOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for number_izds.
     */
    cursor?: number_izdWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` number_izds from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` number_izds.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of number_izds.
     */
    distinct?: Number_izdScalarFieldEnum | Number_izdScalarFieldEnum[]
  }

  /**
   * number_izd findFirstOrThrow
   */
  export type number_izdFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter, which number_izd to fetch.
     */
    where?: number_izdWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of number_izds to fetch.
     */
    orderBy?: number_izdOrderByWithRelationInput | number_izdOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for number_izds.
     */
    cursor?: number_izdWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` number_izds from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` number_izds.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of number_izds.
     */
    distinct?: Number_izdScalarFieldEnum | Number_izdScalarFieldEnum[]
  }

  /**
   * number_izd findMany
   */
  export type number_izdFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter, which number_izds to fetch.
     */
    where?: number_izdWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of number_izds to fetch.
     */
    orderBy?: number_izdOrderByWithRelationInput | number_izdOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing number_izds.
     */
    cursor?: number_izdWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` number_izds from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` number_izds.
     */
    skip?: number
    distinct?: Number_izdScalarFieldEnum | Number_izdScalarFieldEnum[]
  }

  /**
   * number_izd create
   */
  export type number_izdCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * The data needed to create a number_izd.
     */
    data: XOR<number_izdCreateInput, number_izdUncheckedCreateInput>
  }

  /**
   * number_izd createMany
   */
  export type number_izdCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many number_izds.
     */
    data: number_izdCreateManyInput | number_izdCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * number_izd createManyAndReturn
   */
  export type number_izdCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * The data used to create many number_izds.
     */
    data: number_izdCreateManyInput | number_izdCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * number_izd update
   */
  export type number_izdUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * The data needed to update a number_izd.
     */
    data: XOR<number_izdUpdateInput, number_izdUncheckedUpdateInput>
    /**
     * Choose, which number_izd to update.
     */
    where: number_izdWhereUniqueInput
  }

  /**
   * number_izd updateMany
   */
  export type number_izdUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update number_izds.
     */
    data: XOR<number_izdUpdateManyMutationInput, number_izdUncheckedUpdateManyInput>
    /**
     * Filter which number_izds to update
     */
    where?: number_izdWhereInput
    /**
     * Limit how many number_izds to update.
     */
    limit?: number
  }

  /**
   * number_izd updateManyAndReturn
   */
  export type number_izdUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * The data used to update number_izds.
     */
    data: XOR<number_izdUpdateManyMutationInput, number_izdUncheckedUpdateManyInput>
    /**
     * Filter which number_izds to update
     */
    where?: number_izdWhereInput
    /**
     * Limit how many number_izds to update.
     */
    limit?: number
  }

  /**
   * number_izd upsert
   */
  export type number_izdUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * The filter to search for the number_izd to update in case it exists.
     */
    where: number_izdWhereUniqueInput
    /**
     * In case the number_izd found by the `where` argument doesn't exist, create a new number_izd with this data.
     */
    create: XOR<number_izdCreateInput, number_izdUncheckedCreateInput>
    /**
     * In case the number_izd was found with the provided `where` argument, update it with this data.
     */
    update: XOR<number_izdUpdateInput, number_izdUncheckedUpdateInput>
  }

  /**
   * number_izd delete
   */
  export type number_izdDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
    /**
     * Filter which number_izd to delete.
     */
    where: number_izdWhereUniqueInput
  }

  /**
   * number_izd deleteMany
   */
  export type number_izdDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which number_izds to delete
     */
    where?: number_izdWhereInput
    /**
     * Limit how many number_izds to delete.
     */
    limit?: number
  }

  /**
   * number_izd without action
   */
  export type number_izdDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the number_izd
     */
    select?: number_izdSelect<ExtArgs> | null
    /**
     * Omit specific fields from the number_izd
     */
    omit?: number_izdOmit<ExtArgs> | null
  }


  /**
   * Model opred_v
   */

  export type AggregateOpred_v = {
    _count: Opred_vCountAggregateOutputType | null
    _avg: Opred_vAvgAggregateOutputType | null
    _sum: Opred_vSumAggregateOutputType | null
    _min: Opred_vMinAggregateOutputType | null
    _max: Opred_vMaxAggregateOutputType | null
  }

  export type Opred_vAvgAggregateOutputType = {
    id: number | null
    word_id: number | null
    tema: number | null
    livel: number | null
    w1: number | null
    w2: number | null
    w3: number | null
    id_file: number | null
    use_for_bild: number | null
    set_reg: number | null
    back_id: number | null
  }

  export type Opred_vSumAggregateOutputType = {
    id: bigint | null
    word_id: bigint | null
    tema: bigint | null
    livel: number | null
    w1: number | null
    w2: number | null
    w3: number | null
    id_file: bigint | null
    use_for_bild: number | null
    set_reg: bigint | null
    back_id: bigint | null
  }

  export type Opred_vMinAggregateOutputType = {
    id: bigint | null
    word_id: bigint | null
    text_opr: string | null
    end_date: Date | null
    lang: string | null
    tema: bigint | null
    livel: number | null
    w1: number | null
    w2: number | null
    w3: number | null
    id_file: bigint | null
    use_for_bild: number | null
    user_add: string | null
    add_data: Date | null
    edit_user: string | null
    edit_data: Date | null
    coment: string | null
    set_reg: bigint | null
    user_set: string | null
    back_id: bigint | null
  }

  export type Opred_vMaxAggregateOutputType = {
    id: bigint | null
    word_id: bigint | null
    text_opr: string | null
    end_date: Date | null
    lang: string | null
    tema: bigint | null
    livel: number | null
    w1: number | null
    w2: number | null
    w3: number | null
    id_file: bigint | null
    use_for_bild: number | null
    user_add: string | null
    add_data: Date | null
    edit_user: string | null
    edit_data: Date | null
    coment: string | null
    set_reg: bigint | null
    user_set: string | null
    back_id: bigint | null
  }

  export type Opred_vCountAggregateOutputType = {
    id: number
    word_id: number
    text_opr: number
    end_date: number
    lang: number
    tema: number
    livel: number
    w1: number
    w2: number
    w3: number
    id_file: number
    use_for_bild: number
    user_add: number
    add_data: number
    edit_user: number
    edit_data: number
    coment: number
    set_reg: number
    user_set: number
    back_id: number
    _all: number
  }


  export type Opred_vAvgAggregateInputType = {
    id?: true
    word_id?: true
    tema?: true
    livel?: true
    w1?: true
    w2?: true
    w3?: true
    id_file?: true
    use_for_bild?: true
    set_reg?: true
    back_id?: true
  }

  export type Opred_vSumAggregateInputType = {
    id?: true
    word_id?: true
    tema?: true
    livel?: true
    w1?: true
    w2?: true
    w3?: true
    id_file?: true
    use_for_bild?: true
    set_reg?: true
    back_id?: true
  }

  export type Opred_vMinAggregateInputType = {
    id?: true
    word_id?: true
    text_opr?: true
    end_date?: true
    lang?: true
    tema?: true
    livel?: true
    w1?: true
    w2?: true
    w3?: true
    id_file?: true
    use_for_bild?: true
    user_add?: true
    add_data?: true
    edit_user?: true
    edit_data?: true
    coment?: true
    set_reg?: true
    user_set?: true
    back_id?: true
  }

  export type Opred_vMaxAggregateInputType = {
    id?: true
    word_id?: true
    text_opr?: true
    end_date?: true
    lang?: true
    tema?: true
    livel?: true
    w1?: true
    w2?: true
    w3?: true
    id_file?: true
    use_for_bild?: true
    user_add?: true
    add_data?: true
    edit_user?: true
    edit_data?: true
    coment?: true
    set_reg?: true
    user_set?: true
    back_id?: true
  }

  export type Opred_vCountAggregateInputType = {
    id?: true
    word_id?: true
    text_opr?: true
    end_date?: true
    lang?: true
    tema?: true
    livel?: true
    w1?: true
    w2?: true
    w3?: true
    id_file?: true
    use_for_bild?: true
    user_add?: true
    add_data?: true
    edit_user?: true
    edit_data?: true
    coment?: true
    set_reg?: true
    user_set?: true
    back_id?: true
    _all?: true
  }

  export type Opred_vAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which opred_v to aggregate.
     */
    where?: opred_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of opred_vs to fetch.
     */
    orderBy?: opred_vOrderByWithRelationInput | opred_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: opred_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` opred_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` opred_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned opred_vs
    **/
    _count?: true | Opred_vCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Opred_vAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Opred_vSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Opred_vMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Opred_vMaxAggregateInputType
  }

  export type GetOpred_vAggregateType<T extends Opred_vAggregateArgs> = {
        [P in keyof T & keyof AggregateOpred_v]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOpred_v[P]>
      : GetScalarType<T[P], AggregateOpred_v[P]>
  }




  export type opred_vGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: opred_vWhereInput
    orderBy?: opred_vOrderByWithAggregationInput | opred_vOrderByWithAggregationInput[]
    by: Opred_vScalarFieldEnum[] | Opred_vScalarFieldEnum
    having?: opred_vScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Opred_vCountAggregateInputType | true
    _avg?: Opred_vAvgAggregateInputType
    _sum?: Opred_vSumAggregateInputType
    _min?: Opred_vMinAggregateInputType
    _max?: Opred_vMaxAggregateInputType
  }

  export type Opred_vGroupByOutputType = {
    id: bigint
    word_id: bigint
    text_opr: string
    end_date: Date | null
    lang: string
    tema: bigint
    livel: number
    w1: number
    w2: number
    w3: number
    id_file: bigint
    use_for_bild: number
    user_add: string
    add_data: Date | null
    edit_user: string
    edit_data: Date | null
    coment: string
    set_reg: bigint
    user_set: string
    back_id: bigint
    _count: Opred_vCountAggregateOutputType | null
    _avg: Opred_vAvgAggregateOutputType | null
    _sum: Opred_vSumAggregateOutputType | null
    _min: Opred_vMinAggregateOutputType | null
    _max: Opred_vMaxAggregateOutputType | null
  }

  type GetOpred_vGroupByPayload<T extends opred_vGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Opred_vGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Opred_vGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Opred_vGroupByOutputType[P]>
            : GetScalarType<T[P], Opred_vGroupByOutputType[P]>
        }
      >
    >


  export type opred_vSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_id?: boolean
    text_opr?: boolean
    end_date?: boolean
    lang?: boolean
    tema?: boolean
    livel?: boolean
    w1?: boolean
    w2?: boolean
    w3?: boolean
    id_file?: boolean
    use_for_bild?: boolean
    user_add?: boolean
    add_data?: boolean
    edit_user?: boolean
    edit_data?: boolean
    coment?: boolean
    set_reg?: boolean
    user_set?: boolean
    back_id?: boolean
  }, ExtArgs["result"]["opred_v"]>

  export type opred_vSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_id?: boolean
    text_opr?: boolean
    end_date?: boolean
    lang?: boolean
    tema?: boolean
    livel?: boolean
    w1?: boolean
    w2?: boolean
    w3?: boolean
    id_file?: boolean
    use_for_bild?: boolean
    user_add?: boolean
    add_data?: boolean
    edit_user?: boolean
    edit_data?: boolean
    coment?: boolean
    set_reg?: boolean
    user_set?: boolean
    back_id?: boolean
  }, ExtArgs["result"]["opred_v"]>

  export type opred_vSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_id?: boolean
    text_opr?: boolean
    end_date?: boolean
    lang?: boolean
    tema?: boolean
    livel?: boolean
    w1?: boolean
    w2?: boolean
    w3?: boolean
    id_file?: boolean
    use_for_bild?: boolean
    user_add?: boolean
    add_data?: boolean
    edit_user?: boolean
    edit_data?: boolean
    coment?: boolean
    set_reg?: boolean
    user_set?: boolean
    back_id?: boolean
  }, ExtArgs["result"]["opred_v"]>

  export type opred_vSelectScalar = {
    id?: boolean
    word_id?: boolean
    text_opr?: boolean
    end_date?: boolean
    lang?: boolean
    tema?: boolean
    livel?: boolean
    w1?: boolean
    w2?: boolean
    w3?: boolean
    id_file?: boolean
    use_for_bild?: boolean
    user_add?: boolean
    add_data?: boolean
    edit_user?: boolean
    edit_data?: boolean
    coment?: boolean
    set_reg?: boolean
    user_set?: boolean
    back_id?: boolean
  }

  export type opred_vOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "word_id" | "text_opr" | "end_date" | "lang" | "tema" | "livel" | "w1" | "w2" | "w3" | "id_file" | "use_for_bild" | "user_add" | "add_data" | "edit_user" | "edit_data" | "coment" | "set_reg" | "user_set" | "back_id", ExtArgs["result"]["opred_v"]>

  export type $opred_vPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "opred_v"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      word_id: bigint
      text_opr: string
      end_date: Date | null
      lang: string
      tema: bigint
      livel: number
      w1: number
      w2: number
      w3: number
      id_file: bigint
      use_for_bild: number
      user_add: string
      add_data: Date | null
      edit_user: string
      edit_data: Date | null
      coment: string
      set_reg: bigint
      user_set: string
      back_id: bigint
    }, ExtArgs["result"]["opred_v"]>
    composites: {}
  }

  type opred_vGetPayload<S extends boolean | null | undefined | opred_vDefaultArgs> = $Result.GetResult<Prisma.$opred_vPayload, S>

  type opred_vCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<opred_vFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Opred_vCountAggregateInputType | true
    }

  export interface opred_vDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['opred_v'], meta: { name: 'opred_v' } }
    /**
     * Find zero or one Opred_v that matches the filter.
     * @param {opred_vFindUniqueArgs} args - Arguments to find a Opred_v
     * @example
     * // Get one Opred_v
     * const opred_v = await prisma.opred_v.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends opred_vFindUniqueArgs>(args: SelectSubset<T, opred_vFindUniqueArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Opred_v that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {opred_vFindUniqueOrThrowArgs} args - Arguments to find a Opred_v
     * @example
     * // Get one Opred_v
     * const opred_v = await prisma.opred_v.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends opred_vFindUniqueOrThrowArgs>(args: SelectSubset<T, opred_vFindUniqueOrThrowArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Opred_v that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vFindFirstArgs} args - Arguments to find a Opred_v
     * @example
     * // Get one Opred_v
     * const opred_v = await prisma.opred_v.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends opred_vFindFirstArgs>(args?: SelectSubset<T, opred_vFindFirstArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Opred_v that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vFindFirstOrThrowArgs} args - Arguments to find a Opred_v
     * @example
     * // Get one Opred_v
     * const opred_v = await prisma.opred_v.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends opred_vFindFirstOrThrowArgs>(args?: SelectSubset<T, opred_vFindFirstOrThrowArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Opred_vs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Opred_vs
     * const opred_vs = await prisma.opred_v.findMany()
     * 
     * // Get first 10 Opred_vs
     * const opred_vs = await prisma.opred_v.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const opred_vWithIdOnly = await prisma.opred_v.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends opred_vFindManyArgs>(args?: SelectSubset<T, opred_vFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Opred_v.
     * @param {opred_vCreateArgs} args - Arguments to create a Opred_v.
     * @example
     * // Create one Opred_v
     * const Opred_v = await prisma.opred_v.create({
     *   data: {
     *     // ... data to create a Opred_v
     *   }
     * })
     * 
     */
    create<T extends opred_vCreateArgs>(args: SelectSubset<T, opred_vCreateArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Opred_vs.
     * @param {opred_vCreateManyArgs} args - Arguments to create many Opred_vs.
     * @example
     * // Create many Opred_vs
     * const opred_v = await prisma.opred_v.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends opred_vCreateManyArgs>(args?: SelectSubset<T, opred_vCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Opred_vs and returns the data saved in the database.
     * @param {opred_vCreateManyAndReturnArgs} args - Arguments to create many Opred_vs.
     * @example
     * // Create many Opred_vs
     * const opred_v = await prisma.opred_v.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Opred_vs and only return the `id`
     * const opred_vWithIdOnly = await prisma.opred_v.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends opred_vCreateManyAndReturnArgs>(args?: SelectSubset<T, opred_vCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Opred_v.
     * @param {opred_vDeleteArgs} args - Arguments to delete one Opred_v.
     * @example
     * // Delete one Opred_v
     * const Opred_v = await prisma.opred_v.delete({
     *   where: {
     *     // ... filter to delete one Opred_v
     *   }
     * })
     * 
     */
    delete<T extends opred_vDeleteArgs>(args: SelectSubset<T, opred_vDeleteArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Opred_v.
     * @param {opred_vUpdateArgs} args - Arguments to update one Opred_v.
     * @example
     * // Update one Opred_v
     * const opred_v = await prisma.opred_v.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends opred_vUpdateArgs>(args: SelectSubset<T, opred_vUpdateArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Opred_vs.
     * @param {opred_vDeleteManyArgs} args - Arguments to filter Opred_vs to delete.
     * @example
     * // Delete a few Opred_vs
     * const { count } = await prisma.opred_v.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends opred_vDeleteManyArgs>(args?: SelectSubset<T, opred_vDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Opred_vs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Opred_vs
     * const opred_v = await prisma.opred_v.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends opred_vUpdateManyArgs>(args: SelectSubset<T, opred_vUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Opred_vs and returns the data updated in the database.
     * @param {opred_vUpdateManyAndReturnArgs} args - Arguments to update many Opred_vs.
     * @example
     * // Update many Opred_vs
     * const opred_v = await prisma.opred_v.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Opred_vs and only return the `id`
     * const opred_vWithIdOnly = await prisma.opred_v.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends opred_vUpdateManyAndReturnArgs>(args: SelectSubset<T, opred_vUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Opred_v.
     * @param {opred_vUpsertArgs} args - Arguments to update or create a Opred_v.
     * @example
     * // Update or create a Opred_v
     * const opred_v = await prisma.opred_v.upsert({
     *   create: {
     *     // ... data to create a Opred_v
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Opred_v we want to update
     *   }
     * })
     */
    upsert<T extends opred_vUpsertArgs>(args: SelectSubset<T, opred_vUpsertArgs<ExtArgs>>): Prisma__opred_vClient<$Result.GetResult<Prisma.$opred_vPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Opred_vs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vCountArgs} args - Arguments to filter Opred_vs to count.
     * @example
     * // Count the number of Opred_vs
     * const count = await prisma.opred_v.count({
     *   where: {
     *     // ... the filter for the Opred_vs we want to count
     *   }
     * })
    **/
    count<T extends opred_vCountArgs>(
      args?: Subset<T, opred_vCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Opred_vCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Opred_v.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Opred_vAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Opred_vAggregateArgs>(args: Subset<T, Opred_vAggregateArgs>): Prisma.PrismaPromise<GetOpred_vAggregateType<T>>

    /**
     * Group by Opred_v.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {opred_vGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends opred_vGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: opred_vGroupByArgs['orderBy'] }
        : { orderBy?: opred_vGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, opred_vGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOpred_vGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the opred_v model
   */
  readonly fields: opred_vFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for opred_v.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__opred_vClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the opred_v model
   */
  interface opred_vFieldRefs {
    readonly id: FieldRef<"opred_v", 'BigInt'>
    readonly word_id: FieldRef<"opred_v", 'BigInt'>
    readonly text_opr: FieldRef<"opred_v", 'String'>
    readonly end_date: FieldRef<"opred_v", 'DateTime'>
    readonly lang: FieldRef<"opred_v", 'String'>
    readonly tema: FieldRef<"opred_v", 'BigInt'>
    readonly livel: FieldRef<"opred_v", 'Int'>
    readonly w1: FieldRef<"opred_v", 'Int'>
    readonly w2: FieldRef<"opred_v", 'Int'>
    readonly w3: FieldRef<"opred_v", 'Int'>
    readonly id_file: FieldRef<"opred_v", 'BigInt'>
    readonly use_for_bild: FieldRef<"opred_v", 'Int'>
    readonly user_add: FieldRef<"opred_v", 'String'>
    readonly add_data: FieldRef<"opred_v", 'DateTime'>
    readonly edit_user: FieldRef<"opred_v", 'String'>
    readonly edit_data: FieldRef<"opred_v", 'DateTime'>
    readonly coment: FieldRef<"opred_v", 'String'>
    readonly set_reg: FieldRef<"opred_v", 'BigInt'>
    readonly user_set: FieldRef<"opred_v", 'String'>
    readonly back_id: FieldRef<"opred_v", 'BigInt'>
  }
    

  // Custom InputTypes
  /**
   * opred_v findUnique
   */
  export type opred_vFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter, which opred_v to fetch.
     */
    where: opred_vWhereUniqueInput
  }

  /**
   * opred_v findUniqueOrThrow
   */
  export type opred_vFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter, which opred_v to fetch.
     */
    where: opred_vWhereUniqueInput
  }

  /**
   * opred_v findFirst
   */
  export type opred_vFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter, which opred_v to fetch.
     */
    where?: opred_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of opred_vs to fetch.
     */
    orderBy?: opred_vOrderByWithRelationInput | opred_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for opred_vs.
     */
    cursor?: opred_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` opred_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` opred_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of opred_vs.
     */
    distinct?: Opred_vScalarFieldEnum | Opred_vScalarFieldEnum[]
  }

  /**
   * opred_v findFirstOrThrow
   */
  export type opred_vFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter, which opred_v to fetch.
     */
    where?: opred_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of opred_vs to fetch.
     */
    orderBy?: opred_vOrderByWithRelationInput | opred_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for opred_vs.
     */
    cursor?: opred_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` opred_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` opred_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of opred_vs.
     */
    distinct?: Opred_vScalarFieldEnum | Opred_vScalarFieldEnum[]
  }

  /**
   * opred_v findMany
   */
  export type opred_vFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter, which opred_vs to fetch.
     */
    where?: opred_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of opred_vs to fetch.
     */
    orderBy?: opred_vOrderByWithRelationInput | opred_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing opred_vs.
     */
    cursor?: opred_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` opred_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` opred_vs.
     */
    skip?: number
    distinct?: Opred_vScalarFieldEnum | Opred_vScalarFieldEnum[]
  }

  /**
   * opred_v create
   */
  export type opred_vCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * The data needed to create a opred_v.
     */
    data?: XOR<opred_vCreateInput, opred_vUncheckedCreateInput>
  }

  /**
   * opred_v createMany
   */
  export type opred_vCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many opred_vs.
     */
    data: opred_vCreateManyInput | opred_vCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * opred_v createManyAndReturn
   */
  export type opred_vCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * The data used to create many opred_vs.
     */
    data: opred_vCreateManyInput | opred_vCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * opred_v update
   */
  export type opred_vUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * The data needed to update a opred_v.
     */
    data: XOR<opred_vUpdateInput, opred_vUncheckedUpdateInput>
    /**
     * Choose, which opred_v to update.
     */
    where: opred_vWhereUniqueInput
  }

  /**
   * opred_v updateMany
   */
  export type opred_vUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update opred_vs.
     */
    data: XOR<opred_vUpdateManyMutationInput, opred_vUncheckedUpdateManyInput>
    /**
     * Filter which opred_vs to update
     */
    where?: opred_vWhereInput
    /**
     * Limit how many opred_vs to update.
     */
    limit?: number
  }

  /**
   * opred_v updateManyAndReturn
   */
  export type opred_vUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * The data used to update opred_vs.
     */
    data: XOR<opred_vUpdateManyMutationInput, opred_vUncheckedUpdateManyInput>
    /**
     * Filter which opred_vs to update
     */
    where?: opred_vWhereInput
    /**
     * Limit how many opred_vs to update.
     */
    limit?: number
  }

  /**
   * opred_v upsert
   */
  export type opred_vUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * The filter to search for the opred_v to update in case it exists.
     */
    where: opred_vWhereUniqueInput
    /**
     * In case the opred_v found by the `where` argument doesn't exist, create a new opred_v with this data.
     */
    create: XOR<opred_vCreateInput, opred_vUncheckedCreateInput>
    /**
     * In case the opred_v was found with the provided `where` argument, update it with this data.
     */
    update: XOR<opred_vUpdateInput, opred_vUncheckedUpdateInput>
  }

  /**
   * opred_v delete
   */
  export type opred_vDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
    /**
     * Filter which opred_v to delete.
     */
    where: opred_vWhereUniqueInput
  }

  /**
   * opred_v deleteMany
   */
  export type opred_vDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which opred_vs to delete
     */
    where?: opred_vWhereInput
    /**
     * Limit how many opred_vs to delete.
     */
    limit?: number
  }

  /**
   * opred_v without action
   */
  export type opred_vDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the opred_v
     */
    select?: opred_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the opred_v
     */
    omit?: opred_vOmit<ExtArgs> | null
  }


  /**
   * Model publications
   */

  export type AggregatePublications = {
    _count: PublicationsCountAggregateOutputType | null
    _avg: PublicationsAvgAggregateOutputType | null
    _sum: PublicationsSumAggregateOutputType | null
    _min: PublicationsMinAggregateOutputType | null
    _max: PublicationsMaxAggregateOutputType | null
  }

  export type PublicationsAvgAggregateOutputType = {
    id: number | null
    seq_num: number | null
    nameid: number | null
    level: number | null
    repeats: number | null
  }

  export type PublicationsSumAggregateOutputType = {
    id: bigint | null
    seq_num: bigint | null
    nameid: bigint | null
    level: bigint | null
    repeats: bigint | null
  }

  export type PublicationsMinAggregateOutputType = {
    id: bigint | null
    archive: boolean | null
    num: string | null
    seq_num: bigint | null
    nameid: bigint | null
    region: string | null
    level: bigint | null
    repeats: bigint | null
    replacement: string | null
    date: Date | null
  }

  export type PublicationsMaxAggregateOutputType = {
    id: bigint | null
    archive: boolean | null
    num: string | null
    seq_num: bigint | null
    nameid: bigint | null
    region: string | null
    level: bigint | null
    repeats: bigint | null
    replacement: string | null
    date: Date | null
  }

  export type PublicationsCountAggregateOutputType = {
    id: number
    archive: number
    num: number
    seq_num: number
    nameid: number
    region: number
    level: number
    repeats: number
    replacement: number
    date: number
    _all: number
  }


  export type PublicationsAvgAggregateInputType = {
    id?: true
    seq_num?: true
    nameid?: true
    level?: true
    repeats?: true
  }

  export type PublicationsSumAggregateInputType = {
    id?: true
    seq_num?: true
    nameid?: true
    level?: true
    repeats?: true
  }

  export type PublicationsMinAggregateInputType = {
    id?: true
    archive?: true
    num?: true
    seq_num?: true
    nameid?: true
    region?: true
    level?: true
    repeats?: true
    replacement?: true
    date?: true
  }

  export type PublicationsMaxAggregateInputType = {
    id?: true
    archive?: true
    num?: true
    seq_num?: true
    nameid?: true
    region?: true
    level?: true
    repeats?: true
    replacement?: true
    date?: true
  }

  export type PublicationsCountAggregateInputType = {
    id?: true
    archive?: true
    num?: true
    seq_num?: true
    nameid?: true
    region?: true
    level?: true
    repeats?: true
    replacement?: true
    date?: true
    _all?: true
  }

  export type PublicationsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which publications to aggregate.
     */
    where?: publicationsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of publications to fetch.
     */
    orderBy?: publicationsOrderByWithRelationInput | publicationsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: publicationsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` publications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` publications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned publications
    **/
    _count?: true | PublicationsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PublicationsAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PublicationsSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PublicationsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PublicationsMaxAggregateInputType
  }

  export type GetPublicationsAggregateType<T extends PublicationsAggregateArgs> = {
        [P in keyof T & keyof AggregatePublications]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePublications[P]>
      : GetScalarType<T[P], AggregatePublications[P]>
  }




  export type publicationsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: publicationsWhereInput
    orderBy?: publicationsOrderByWithAggregationInput | publicationsOrderByWithAggregationInput[]
    by: PublicationsScalarFieldEnum[] | PublicationsScalarFieldEnum
    having?: publicationsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PublicationsCountAggregateInputType | true
    _avg?: PublicationsAvgAggregateInputType
    _sum?: PublicationsSumAggregateInputType
    _min?: PublicationsMinAggregateInputType
    _max?: PublicationsMaxAggregateInputType
  }

  export type PublicationsGroupByOutputType = {
    id: bigint
    archive: boolean
    num: string
    seq_num: bigint
    nameid: bigint
    region: string | null
    level: bigint | null
    repeats: bigint
    replacement: string | null
    date: Date | null
    _count: PublicationsCountAggregateOutputType | null
    _avg: PublicationsAvgAggregateOutputType | null
    _sum: PublicationsSumAggregateOutputType | null
    _min: PublicationsMinAggregateOutputType | null
    _max: PublicationsMaxAggregateOutputType | null
  }

  type GetPublicationsGroupByPayload<T extends publicationsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PublicationsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PublicationsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PublicationsGroupByOutputType[P]>
            : GetScalarType<T[P], PublicationsGroupByOutputType[P]>
        }
      >
    >


  export type publicationsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    archive?: boolean
    num?: boolean
    seq_num?: boolean
    nameid?: boolean
    region?: boolean
    level?: boolean
    repeats?: boolean
    replacement?: boolean
    date?: boolean
  }, ExtArgs["result"]["publications"]>

  export type publicationsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    archive?: boolean
    num?: boolean
    seq_num?: boolean
    nameid?: boolean
    region?: boolean
    level?: boolean
    repeats?: boolean
    replacement?: boolean
    date?: boolean
  }, ExtArgs["result"]["publications"]>

  export type publicationsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    archive?: boolean
    num?: boolean
    seq_num?: boolean
    nameid?: boolean
    region?: boolean
    level?: boolean
    repeats?: boolean
    replacement?: boolean
    date?: boolean
  }, ExtArgs["result"]["publications"]>

  export type publicationsSelectScalar = {
    id?: boolean
    archive?: boolean
    num?: boolean
    seq_num?: boolean
    nameid?: boolean
    region?: boolean
    level?: boolean
    repeats?: boolean
    replacement?: boolean
    date?: boolean
  }

  export type publicationsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "archive" | "num" | "seq_num" | "nameid" | "region" | "level" | "repeats" | "replacement" | "date", ExtArgs["result"]["publications"]>

  export type $publicationsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "publications"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      archive: boolean
      num: string
      seq_num: bigint
      nameid: bigint
      region: string | null
      level: bigint | null
      repeats: bigint
      replacement: string | null
      date: Date | null
    }, ExtArgs["result"]["publications"]>
    composites: {}
  }

  type publicationsGetPayload<S extends boolean | null | undefined | publicationsDefaultArgs> = $Result.GetResult<Prisma.$publicationsPayload, S>

  type publicationsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<publicationsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PublicationsCountAggregateInputType | true
    }

  export interface publicationsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['publications'], meta: { name: 'publications' } }
    /**
     * Find zero or one Publications that matches the filter.
     * @param {publicationsFindUniqueArgs} args - Arguments to find a Publications
     * @example
     * // Get one Publications
     * const publications = await prisma.publications.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends publicationsFindUniqueArgs>(args: SelectSubset<T, publicationsFindUniqueArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Publications that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {publicationsFindUniqueOrThrowArgs} args - Arguments to find a Publications
     * @example
     * // Get one Publications
     * const publications = await prisma.publications.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends publicationsFindUniqueOrThrowArgs>(args: SelectSubset<T, publicationsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Publications that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsFindFirstArgs} args - Arguments to find a Publications
     * @example
     * // Get one Publications
     * const publications = await prisma.publications.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends publicationsFindFirstArgs>(args?: SelectSubset<T, publicationsFindFirstArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Publications that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsFindFirstOrThrowArgs} args - Arguments to find a Publications
     * @example
     * // Get one Publications
     * const publications = await prisma.publications.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends publicationsFindFirstOrThrowArgs>(args?: SelectSubset<T, publicationsFindFirstOrThrowArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Publications that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Publications
     * const publications = await prisma.publications.findMany()
     * 
     * // Get first 10 Publications
     * const publications = await prisma.publications.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const publicationsWithIdOnly = await prisma.publications.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends publicationsFindManyArgs>(args?: SelectSubset<T, publicationsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Publications.
     * @param {publicationsCreateArgs} args - Arguments to create a Publications.
     * @example
     * // Create one Publications
     * const Publications = await prisma.publications.create({
     *   data: {
     *     // ... data to create a Publications
     *   }
     * })
     * 
     */
    create<T extends publicationsCreateArgs>(args: SelectSubset<T, publicationsCreateArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Publications.
     * @param {publicationsCreateManyArgs} args - Arguments to create many Publications.
     * @example
     * // Create many Publications
     * const publications = await prisma.publications.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends publicationsCreateManyArgs>(args?: SelectSubset<T, publicationsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Publications and returns the data saved in the database.
     * @param {publicationsCreateManyAndReturnArgs} args - Arguments to create many Publications.
     * @example
     * // Create many Publications
     * const publications = await prisma.publications.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Publications and only return the `id`
     * const publicationsWithIdOnly = await prisma.publications.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends publicationsCreateManyAndReturnArgs>(args?: SelectSubset<T, publicationsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Publications.
     * @param {publicationsDeleteArgs} args - Arguments to delete one Publications.
     * @example
     * // Delete one Publications
     * const Publications = await prisma.publications.delete({
     *   where: {
     *     // ... filter to delete one Publications
     *   }
     * })
     * 
     */
    delete<T extends publicationsDeleteArgs>(args: SelectSubset<T, publicationsDeleteArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Publications.
     * @param {publicationsUpdateArgs} args - Arguments to update one Publications.
     * @example
     * // Update one Publications
     * const publications = await prisma.publications.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends publicationsUpdateArgs>(args: SelectSubset<T, publicationsUpdateArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Publications.
     * @param {publicationsDeleteManyArgs} args - Arguments to filter Publications to delete.
     * @example
     * // Delete a few Publications
     * const { count } = await prisma.publications.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends publicationsDeleteManyArgs>(args?: SelectSubset<T, publicationsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Publications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Publications
     * const publications = await prisma.publications.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends publicationsUpdateManyArgs>(args: SelectSubset<T, publicationsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Publications and returns the data updated in the database.
     * @param {publicationsUpdateManyAndReturnArgs} args - Arguments to update many Publications.
     * @example
     * // Update many Publications
     * const publications = await prisma.publications.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Publications and only return the `id`
     * const publicationsWithIdOnly = await prisma.publications.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends publicationsUpdateManyAndReturnArgs>(args: SelectSubset<T, publicationsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Publications.
     * @param {publicationsUpsertArgs} args - Arguments to update or create a Publications.
     * @example
     * // Update or create a Publications
     * const publications = await prisma.publications.upsert({
     *   create: {
     *     // ... data to create a Publications
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Publications we want to update
     *   }
     * })
     */
    upsert<T extends publicationsUpsertArgs>(args: SelectSubset<T, publicationsUpsertArgs<ExtArgs>>): Prisma__publicationsClient<$Result.GetResult<Prisma.$publicationsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Publications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsCountArgs} args - Arguments to filter Publications to count.
     * @example
     * // Count the number of Publications
     * const count = await prisma.publications.count({
     *   where: {
     *     // ... the filter for the Publications we want to count
     *   }
     * })
    **/
    count<T extends publicationsCountArgs>(
      args?: Subset<T, publicationsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PublicationsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Publications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PublicationsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PublicationsAggregateArgs>(args: Subset<T, PublicationsAggregateArgs>): Prisma.PrismaPromise<GetPublicationsAggregateType<T>>

    /**
     * Group by Publications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {publicationsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends publicationsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: publicationsGroupByArgs['orderBy'] }
        : { orderBy?: publicationsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, publicationsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPublicationsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the publications model
   */
  readonly fields: publicationsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for publications.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__publicationsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the publications model
   */
  interface publicationsFieldRefs {
    readonly id: FieldRef<"publications", 'BigInt'>
    readonly archive: FieldRef<"publications", 'Boolean'>
    readonly num: FieldRef<"publications", 'String'>
    readonly seq_num: FieldRef<"publications", 'BigInt'>
    readonly nameid: FieldRef<"publications", 'BigInt'>
    readonly region: FieldRef<"publications", 'String'>
    readonly level: FieldRef<"publications", 'BigInt'>
    readonly repeats: FieldRef<"publications", 'BigInt'>
    readonly replacement: FieldRef<"publications", 'String'>
    readonly date: FieldRef<"publications", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * publications findUnique
   */
  export type publicationsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter, which publications to fetch.
     */
    where: publicationsWhereUniqueInput
  }

  /**
   * publications findUniqueOrThrow
   */
  export type publicationsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter, which publications to fetch.
     */
    where: publicationsWhereUniqueInput
  }

  /**
   * publications findFirst
   */
  export type publicationsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter, which publications to fetch.
     */
    where?: publicationsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of publications to fetch.
     */
    orderBy?: publicationsOrderByWithRelationInput | publicationsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for publications.
     */
    cursor?: publicationsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` publications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` publications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of publications.
     */
    distinct?: PublicationsScalarFieldEnum | PublicationsScalarFieldEnum[]
  }

  /**
   * publications findFirstOrThrow
   */
  export type publicationsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter, which publications to fetch.
     */
    where?: publicationsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of publications to fetch.
     */
    orderBy?: publicationsOrderByWithRelationInput | publicationsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for publications.
     */
    cursor?: publicationsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` publications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` publications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of publications.
     */
    distinct?: PublicationsScalarFieldEnum | PublicationsScalarFieldEnum[]
  }

  /**
   * publications findMany
   */
  export type publicationsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter, which publications to fetch.
     */
    where?: publicationsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of publications to fetch.
     */
    orderBy?: publicationsOrderByWithRelationInput | publicationsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing publications.
     */
    cursor?: publicationsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` publications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` publications.
     */
    skip?: number
    distinct?: PublicationsScalarFieldEnum | PublicationsScalarFieldEnum[]
  }

  /**
   * publications create
   */
  export type publicationsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * The data needed to create a publications.
     */
    data: XOR<publicationsCreateInput, publicationsUncheckedCreateInput>
  }

  /**
   * publications createMany
   */
  export type publicationsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many publications.
     */
    data: publicationsCreateManyInput | publicationsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * publications createManyAndReturn
   */
  export type publicationsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * The data used to create many publications.
     */
    data: publicationsCreateManyInput | publicationsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * publications update
   */
  export type publicationsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * The data needed to update a publications.
     */
    data: XOR<publicationsUpdateInput, publicationsUncheckedUpdateInput>
    /**
     * Choose, which publications to update.
     */
    where: publicationsWhereUniqueInput
  }

  /**
   * publications updateMany
   */
  export type publicationsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update publications.
     */
    data: XOR<publicationsUpdateManyMutationInput, publicationsUncheckedUpdateManyInput>
    /**
     * Filter which publications to update
     */
    where?: publicationsWhereInput
    /**
     * Limit how many publications to update.
     */
    limit?: number
  }

  /**
   * publications updateManyAndReturn
   */
  export type publicationsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * The data used to update publications.
     */
    data: XOR<publicationsUpdateManyMutationInput, publicationsUncheckedUpdateManyInput>
    /**
     * Filter which publications to update
     */
    where?: publicationsWhereInput
    /**
     * Limit how many publications to update.
     */
    limit?: number
  }

  /**
   * publications upsert
   */
  export type publicationsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * The filter to search for the publications to update in case it exists.
     */
    where: publicationsWhereUniqueInput
    /**
     * In case the publications found by the `where` argument doesn't exist, create a new publications with this data.
     */
    create: XOR<publicationsCreateInput, publicationsUncheckedCreateInput>
    /**
     * In case the publications was found with the provided `where` argument, update it with this data.
     */
    update: XOR<publicationsUpdateInput, publicationsUncheckedUpdateInput>
  }

  /**
   * publications delete
   */
  export type publicationsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
    /**
     * Filter which publications to delete.
     */
    where: publicationsWhereUniqueInput
  }

  /**
   * publications deleteMany
   */
  export type publicationsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which publications to delete
     */
    where?: publicationsWhereInput
    /**
     * Limit how many publications to delete.
     */
    limit?: number
  }

  /**
   * publications without action
   */
  export type publicationsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the publications
     */
    select?: publicationsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the publications
     */
    omit?: publicationsOmit<ExtArgs> | null
  }


  /**
   * Model shablon
   */

  export type AggregateShablon = {
    _count: ShablonCountAggregateOutputType | null
    _avg: ShablonAvgAggregateOutputType | null
    _sum: ShablonSumAggregateOutputType | null
    _min: ShablonMinAggregateOutputType | null
    _max: ShablonMaxAggregateOutputType | null
  }

  export type ShablonAvgAggregateOutputType = {
    id: number | null
    w_pazl: number | null
    h_pazl: number | null
    foto: number | null
    oprd_foto: number | null
    big_cell: number | null
    hide_cell: number | null
    use_year: number | null
    use_mon: number | null
  }

  export type ShablonSumAggregateOutputType = {
    id: bigint | null
    w_pazl: bigint | null
    h_pazl: bigint | null
    foto: number | null
    oprd_foto: number | null
    big_cell: bigint | null
    hide_cell: number | null
    use_year: number | null
    use_mon: number | null
  }

  export type ShablonMinAggregateOutputType = {
    id: bigint | null
    w_pazl: bigint | null
    h_pazl: bigint | null
    foto: number | null
    oprd_foto: number | null
    big_cell: bigint | null
    hide_cell: number | null
    md: string | null
    type_pazl: string | null
    char_mask: string | null
    use_year: number | null
    use_mon: number | null
    add_data: Date | null
  }

  export type ShablonMaxAggregateOutputType = {
    id: bigint | null
    w_pazl: bigint | null
    h_pazl: bigint | null
    foto: number | null
    oprd_foto: number | null
    big_cell: bigint | null
    hide_cell: number | null
    md: string | null
    type_pazl: string | null
    char_mask: string | null
    use_year: number | null
    use_mon: number | null
    add_data: Date | null
  }

  export type ShablonCountAggregateOutputType = {
    id: number
    w_pazl: number
    h_pazl: number
    foto: number
    oprd_foto: number
    big_cell: number
    hide_cell: number
    md: number
    type_pazl: number
    char_mask: number
    use_year: number
    use_mon: number
    add_data: number
    _all: number
  }


  export type ShablonAvgAggregateInputType = {
    id?: true
    w_pazl?: true
    h_pazl?: true
    foto?: true
    oprd_foto?: true
    big_cell?: true
    hide_cell?: true
    use_year?: true
    use_mon?: true
  }

  export type ShablonSumAggregateInputType = {
    id?: true
    w_pazl?: true
    h_pazl?: true
    foto?: true
    oprd_foto?: true
    big_cell?: true
    hide_cell?: true
    use_year?: true
    use_mon?: true
  }

  export type ShablonMinAggregateInputType = {
    id?: true
    w_pazl?: true
    h_pazl?: true
    foto?: true
    oprd_foto?: true
    big_cell?: true
    hide_cell?: true
    md?: true
    type_pazl?: true
    char_mask?: true
    use_year?: true
    use_mon?: true
    add_data?: true
  }

  export type ShablonMaxAggregateInputType = {
    id?: true
    w_pazl?: true
    h_pazl?: true
    foto?: true
    oprd_foto?: true
    big_cell?: true
    hide_cell?: true
    md?: true
    type_pazl?: true
    char_mask?: true
    use_year?: true
    use_mon?: true
    add_data?: true
  }

  export type ShablonCountAggregateInputType = {
    id?: true
    w_pazl?: true
    h_pazl?: true
    foto?: true
    oprd_foto?: true
    big_cell?: true
    hide_cell?: true
    md?: true
    type_pazl?: true
    char_mask?: true
    use_year?: true
    use_mon?: true
    add_data?: true
    _all?: true
  }

  export type ShablonAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which shablon to aggregate.
     */
    where?: shablonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shablons to fetch.
     */
    orderBy?: shablonOrderByWithRelationInput | shablonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: shablonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shablons from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shablons.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned shablons
    **/
    _count?: true | ShablonCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ShablonAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ShablonSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ShablonMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ShablonMaxAggregateInputType
  }

  export type GetShablonAggregateType<T extends ShablonAggregateArgs> = {
        [P in keyof T & keyof AggregateShablon]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateShablon[P]>
      : GetScalarType<T[P], AggregateShablon[P]>
  }




  export type shablonGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: shablonWhereInput
    orderBy?: shablonOrderByWithAggregationInput | shablonOrderByWithAggregationInput[]
    by: ShablonScalarFieldEnum[] | ShablonScalarFieldEnum
    having?: shablonScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ShablonCountAggregateInputType | true
    _avg?: ShablonAvgAggregateInputType
    _sum?: ShablonSumAggregateInputType
    _min?: ShablonMinAggregateInputType
    _max?: ShablonMaxAggregateInputType
  }

  export type ShablonGroupByOutputType = {
    id: bigint
    w_pazl: bigint
    h_pazl: bigint
    foto: number
    oprd_foto: number
    big_cell: bigint
    hide_cell: number
    md: string
    type_pazl: string
    char_mask: string | null
    use_year: number
    use_mon: number
    add_data: Date | null
    _count: ShablonCountAggregateOutputType | null
    _avg: ShablonAvgAggregateOutputType | null
    _sum: ShablonSumAggregateOutputType | null
    _min: ShablonMinAggregateOutputType | null
    _max: ShablonMaxAggregateOutputType | null
  }

  type GetShablonGroupByPayload<T extends shablonGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ShablonGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ShablonGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ShablonGroupByOutputType[P]>
            : GetScalarType<T[P], ShablonGroupByOutputType[P]>
        }
      >
    >


  export type shablonSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    w_pazl?: boolean
    h_pazl?: boolean
    foto?: boolean
    oprd_foto?: boolean
    big_cell?: boolean
    hide_cell?: boolean
    md?: boolean
    type_pazl?: boolean
    char_mask?: boolean
    use_year?: boolean
    use_mon?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["shablon"]>

  export type shablonSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    w_pazl?: boolean
    h_pazl?: boolean
    foto?: boolean
    oprd_foto?: boolean
    big_cell?: boolean
    hide_cell?: boolean
    md?: boolean
    type_pazl?: boolean
    char_mask?: boolean
    use_year?: boolean
    use_mon?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["shablon"]>

  export type shablonSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    w_pazl?: boolean
    h_pazl?: boolean
    foto?: boolean
    oprd_foto?: boolean
    big_cell?: boolean
    hide_cell?: boolean
    md?: boolean
    type_pazl?: boolean
    char_mask?: boolean
    use_year?: boolean
    use_mon?: boolean
    add_data?: boolean
  }, ExtArgs["result"]["shablon"]>

  export type shablonSelectScalar = {
    id?: boolean
    w_pazl?: boolean
    h_pazl?: boolean
    foto?: boolean
    oprd_foto?: boolean
    big_cell?: boolean
    hide_cell?: boolean
    md?: boolean
    type_pazl?: boolean
    char_mask?: boolean
    use_year?: boolean
    use_mon?: boolean
    add_data?: boolean
  }

  export type shablonOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "w_pazl" | "h_pazl" | "foto" | "oprd_foto" | "big_cell" | "hide_cell" | "md" | "type_pazl" | "char_mask" | "use_year" | "use_mon" | "add_data", ExtArgs["result"]["shablon"]>

  export type $shablonPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "shablon"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      w_pazl: bigint
      h_pazl: bigint
      foto: number
      oprd_foto: number
      big_cell: bigint
      hide_cell: number
      md: string
      type_pazl: string
      char_mask: string | null
      use_year: number
      use_mon: number
      add_data: Date | null
    }, ExtArgs["result"]["shablon"]>
    composites: {}
  }

  type shablonGetPayload<S extends boolean | null | undefined | shablonDefaultArgs> = $Result.GetResult<Prisma.$shablonPayload, S>

  type shablonCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<shablonFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ShablonCountAggregateInputType | true
    }

  export interface shablonDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['shablon'], meta: { name: 'shablon' } }
    /**
     * Find zero or one Shablon that matches the filter.
     * @param {shablonFindUniqueArgs} args - Arguments to find a Shablon
     * @example
     * // Get one Shablon
     * const shablon = await prisma.shablon.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends shablonFindUniqueArgs>(args: SelectSubset<T, shablonFindUniqueArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Shablon that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {shablonFindUniqueOrThrowArgs} args - Arguments to find a Shablon
     * @example
     * // Get one Shablon
     * const shablon = await prisma.shablon.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends shablonFindUniqueOrThrowArgs>(args: SelectSubset<T, shablonFindUniqueOrThrowArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Shablon that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonFindFirstArgs} args - Arguments to find a Shablon
     * @example
     * // Get one Shablon
     * const shablon = await prisma.shablon.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends shablonFindFirstArgs>(args?: SelectSubset<T, shablonFindFirstArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Shablon that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonFindFirstOrThrowArgs} args - Arguments to find a Shablon
     * @example
     * // Get one Shablon
     * const shablon = await prisma.shablon.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends shablonFindFirstOrThrowArgs>(args?: SelectSubset<T, shablonFindFirstOrThrowArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Shablons that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Shablons
     * const shablons = await prisma.shablon.findMany()
     * 
     * // Get first 10 Shablons
     * const shablons = await prisma.shablon.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const shablonWithIdOnly = await prisma.shablon.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends shablonFindManyArgs>(args?: SelectSubset<T, shablonFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Shablon.
     * @param {shablonCreateArgs} args - Arguments to create a Shablon.
     * @example
     * // Create one Shablon
     * const Shablon = await prisma.shablon.create({
     *   data: {
     *     // ... data to create a Shablon
     *   }
     * })
     * 
     */
    create<T extends shablonCreateArgs>(args: SelectSubset<T, shablonCreateArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Shablons.
     * @param {shablonCreateManyArgs} args - Arguments to create many Shablons.
     * @example
     * // Create many Shablons
     * const shablon = await prisma.shablon.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends shablonCreateManyArgs>(args?: SelectSubset<T, shablonCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Shablons and returns the data saved in the database.
     * @param {shablonCreateManyAndReturnArgs} args - Arguments to create many Shablons.
     * @example
     * // Create many Shablons
     * const shablon = await prisma.shablon.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Shablons and only return the `id`
     * const shablonWithIdOnly = await prisma.shablon.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends shablonCreateManyAndReturnArgs>(args?: SelectSubset<T, shablonCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Shablon.
     * @param {shablonDeleteArgs} args - Arguments to delete one Shablon.
     * @example
     * // Delete one Shablon
     * const Shablon = await prisma.shablon.delete({
     *   where: {
     *     // ... filter to delete one Shablon
     *   }
     * })
     * 
     */
    delete<T extends shablonDeleteArgs>(args: SelectSubset<T, shablonDeleteArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Shablon.
     * @param {shablonUpdateArgs} args - Arguments to update one Shablon.
     * @example
     * // Update one Shablon
     * const shablon = await prisma.shablon.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends shablonUpdateArgs>(args: SelectSubset<T, shablonUpdateArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Shablons.
     * @param {shablonDeleteManyArgs} args - Arguments to filter Shablons to delete.
     * @example
     * // Delete a few Shablons
     * const { count } = await prisma.shablon.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends shablonDeleteManyArgs>(args?: SelectSubset<T, shablonDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Shablons.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Shablons
     * const shablon = await prisma.shablon.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends shablonUpdateManyArgs>(args: SelectSubset<T, shablonUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Shablons and returns the data updated in the database.
     * @param {shablonUpdateManyAndReturnArgs} args - Arguments to update many Shablons.
     * @example
     * // Update many Shablons
     * const shablon = await prisma.shablon.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Shablons and only return the `id`
     * const shablonWithIdOnly = await prisma.shablon.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends shablonUpdateManyAndReturnArgs>(args: SelectSubset<T, shablonUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Shablon.
     * @param {shablonUpsertArgs} args - Arguments to update or create a Shablon.
     * @example
     * // Update or create a Shablon
     * const shablon = await prisma.shablon.upsert({
     *   create: {
     *     // ... data to create a Shablon
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Shablon we want to update
     *   }
     * })
     */
    upsert<T extends shablonUpsertArgs>(args: SelectSubset<T, shablonUpsertArgs<ExtArgs>>): Prisma__shablonClient<$Result.GetResult<Prisma.$shablonPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Shablons.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonCountArgs} args - Arguments to filter Shablons to count.
     * @example
     * // Count the number of Shablons
     * const count = await prisma.shablon.count({
     *   where: {
     *     // ... the filter for the Shablons we want to count
     *   }
     * })
    **/
    count<T extends shablonCountArgs>(
      args?: Subset<T, shablonCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ShablonCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Shablon.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShablonAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ShablonAggregateArgs>(args: Subset<T, ShablonAggregateArgs>): Prisma.PrismaPromise<GetShablonAggregateType<T>>

    /**
     * Group by Shablon.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shablonGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends shablonGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: shablonGroupByArgs['orderBy'] }
        : { orderBy?: shablonGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, shablonGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetShablonGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the shablon model
   */
  readonly fields: shablonFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for shablon.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__shablonClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the shablon model
   */
  interface shablonFieldRefs {
    readonly id: FieldRef<"shablon", 'BigInt'>
    readonly w_pazl: FieldRef<"shablon", 'BigInt'>
    readonly h_pazl: FieldRef<"shablon", 'BigInt'>
    readonly foto: FieldRef<"shablon", 'Int'>
    readonly oprd_foto: FieldRef<"shablon", 'Int'>
    readonly big_cell: FieldRef<"shablon", 'BigInt'>
    readonly hide_cell: FieldRef<"shablon", 'Int'>
    readonly md: FieldRef<"shablon", 'String'>
    readonly type_pazl: FieldRef<"shablon", 'String'>
    readonly char_mask: FieldRef<"shablon", 'String'>
    readonly use_year: FieldRef<"shablon", 'Int'>
    readonly use_mon: FieldRef<"shablon", 'Int'>
    readonly add_data: FieldRef<"shablon", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * shablon findUnique
   */
  export type shablonFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter, which shablon to fetch.
     */
    where: shablonWhereUniqueInput
  }

  /**
   * shablon findUniqueOrThrow
   */
  export type shablonFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter, which shablon to fetch.
     */
    where: shablonWhereUniqueInput
  }

  /**
   * shablon findFirst
   */
  export type shablonFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter, which shablon to fetch.
     */
    where?: shablonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shablons to fetch.
     */
    orderBy?: shablonOrderByWithRelationInput | shablonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for shablons.
     */
    cursor?: shablonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shablons from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shablons.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of shablons.
     */
    distinct?: ShablonScalarFieldEnum | ShablonScalarFieldEnum[]
  }

  /**
   * shablon findFirstOrThrow
   */
  export type shablonFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter, which shablon to fetch.
     */
    where?: shablonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shablons to fetch.
     */
    orderBy?: shablonOrderByWithRelationInput | shablonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for shablons.
     */
    cursor?: shablonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shablons from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shablons.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of shablons.
     */
    distinct?: ShablonScalarFieldEnum | ShablonScalarFieldEnum[]
  }

  /**
   * shablon findMany
   */
  export type shablonFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter, which shablons to fetch.
     */
    where?: shablonWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shablons to fetch.
     */
    orderBy?: shablonOrderByWithRelationInput | shablonOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing shablons.
     */
    cursor?: shablonWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shablons from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shablons.
     */
    skip?: number
    distinct?: ShablonScalarFieldEnum | ShablonScalarFieldEnum[]
  }

  /**
   * shablon create
   */
  export type shablonCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * The data needed to create a shablon.
     */
    data: XOR<shablonCreateInput, shablonUncheckedCreateInput>
  }

  /**
   * shablon createMany
   */
  export type shablonCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many shablons.
     */
    data: shablonCreateManyInput | shablonCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * shablon createManyAndReturn
   */
  export type shablonCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * The data used to create many shablons.
     */
    data: shablonCreateManyInput | shablonCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * shablon update
   */
  export type shablonUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * The data needed to update a shablon.
     */
    data: XOR<shablonUpdateInput, shablonUncheckedUpdateInput>
    /**
     * Choose, which shablon to update.
     */
    where: shablonWhereUniqueInput
  }

  /**
   * shablon updateMany
   */
  export type shablonUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update shablons.
     */
    data: XOR<shablonUpdateManyMutationInput, shablonUncheckedUpdateManyInput>
    /**
     * Filter which shablons to update
     */
    where?: shablonWhereInput
    /**
     * Limit how many shablons to update.
     */
    limit?: number
  }

  /**
   * shablon updateManyAndReturn
   */
  export type shablonUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * The data used to update shablons.
     */
    data: XOR<shablonUpdateManyMutationInput, shablonUncheckedUpdateManyInput>
    /**
     * Filter which shablons to update
     */
    where?: shablonWhereInput
    /**
     * Limit how many shablons to update.
     */
    limit?: number
  }

  /**
   * shablon upsert
   */
  export type shablonUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * The filter to search for the shablon to update in case it exists.
     */
    where: shablonWhereUniqueInput
    /**
     * In case the shablon found by the `where` argument doesn't exist, create a new shablon with this data.
     */
    create: XOR<shablonCreateInput, shablonUncheckedCreateInput>
    /**
     * In case the shablon was found with the provided `where` argument, update it with this data.
     */
    update: XOR<shablonUpdateInput, shablonUncheckedUpdateInput>
  }

  /**
   * shablon delete
   */
  export type shablonDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
    /**
     * Filter which shablon to delete.
     */
    where: shablonWhereUniqueInput
  }

  /**
   * shablon deleteMany
   */
  export type shablonDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which shablons to delete
     */
    where?: shablonWhereInput
    /**
     * Limit how many shablons to delete.
     */
    limit?: number
  }

  /**
   * shablon without action
   */
  export type shablonDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shablon
     */
    select?: shablonSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shablon
     */
    omit?: shablonOmit<ExtArgs> | null
  }


  /**
   * Model shtat
   */

  export type AggregateShtat = {
    _count: ShtatCountAggregateOutputType | null
    _avg: ShtatAvgAggregateOutputType | null
    _sum: ShtatSumAggregateOutputType | null
    _min: ShtatMinAggregateOutputType | null
    _max: ShtatMaxAggregateOutputType | null
  }

  export type ShtatAvgAggregateOutputType = {
    id: number | null
    user_id: number | null
    shtat: number | null
    market: number | null
    design: number | null
    lit_baz: number | null
  }

  export type ShtatSumAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
    shtat: number | null
    market: bigint | null
    design: bigint | null
    lit_baz: number | null
  }

  export type ShtatMinAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
    shtat: number | null
    market: bigint | null
    scan_bild: string | null
    red_izd: string | null
    design: bigint | null
    lit_baz: number | null
    admin: boolean | null
  }

  export type ShtatMaxAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
    shtat: number | null
    market: bigint | null
    scan_bild: string | null
    red_izd: string | null
    design: bigint | null
    lit_baz: number | null
    admin: boolean | null
  }

  export type ShtatCountAggregateOutputType = {
    id: number
    user_id: number
    shtat: number
    market: number
    scan_bild: number
    red_izd: number
    design: number
    lit_baz: number
    admin: number
    _all: number
  }


  export type ShtatAvgAggregateInputType = {
    id?: true
    user_id?: true
    shtat?: true
    market?: true
    design?: true
    lit_baz?: true
  }

  export type ShtatSumAggregateInputType = {
    id?: true
    user_id?: true
    shtat?: true
    market?: true
    design?: true
    lit_baz?: true
  }

  export type ShtatMinAggregateInputType = {
    id?: true
    user_id?: true
    shtat?: true
    market?: true
    scan_bild?: true
    red_izd?: true
    design?: true
    lit_baz?: true
    admin?: true
  }

  export type ShtatMaxAggregateInputType = {
    id?: true
    user_id?: true
    shtat?: true
    market?: true
    scan_bild?: true
    red_izd?: true
    design?: true
    lit_baz?: true
    admin?: true
  }

  export type ShtatCountAggregateInputType = {
    id?: true
    user_id?: true
    shtat?: true
    market?: true
    scan_bild?: true
    red_izd?: true
    design?: true
    lit_baz?: true
    admin?: true
    _all?: true
  }

  export type ShtatAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which shtat to aggregate.
     */
    where?: shtatWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shtats to fetch.
     */
    orderBy?: shtatOrderByWithRelationInput | shtatOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: shtatWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shtats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shtats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned shtats
    **/
    _count?: true | ShtatCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ShtatAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ShtatSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ShtatMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ShtatMaxAggregateInputType
  }

  export type GetShtatAggregateType<T extends ShtatAggregateArgs> = {
        [P in keyof T & keyof AggregateShtat]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateShtat[P]>
      : GetScalarType<T[P], AggregateShtat[P]>
  }




  export type shtatGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: shtatWhereInput
    orderBy?: shtatOrderByWithAggregationInput | shtatOrderByWithAggregationInput[]
    by: ShtatScalarFieldEnum[] | ShtatScalarFieldEnum
    having?: shtatScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ShtatCountAggregateInputType | true
    _avg?: ShtatAvgAggregateInputType
    _sum?: ShtatSumAggregateInputType
    _min?: ShtatMinAggregateInputType
    _max?: ShtatMaxAggregateInputType
  }

  export type ShtatGroupByOutputType = {
    id: bigint
    user_id: bigint
    shtat: number
    market: bigint
    scan_bild: string
    red_izd: string
    design: bigint
    lit_baz: number
    admin: boolean
    _count: ShtatCountAggregateOutputType | null
    _avg: ShtatAvgAggregateOutputType | null
    _sum: ShtatSumAggregateOutputType | null
    _min: ShtatMinAggregateOutputType | null
    _max: ShtatMaxAggregateOutputType | null
  }

  type GetShtatGroupByPayload<T extends shtatGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ShtatGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ShtatGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ShtatGroupByOutputType[P]>
            : GetScalarType<T[P], ShtatGroupByOutputType[P]>
        }
      >
    >


  export type shtatSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    shtat?: boolean
    market?: boolean
    scan_bild?: boolean
    red_izd?: boolean
    design?: boolean
    lit_baz?: boolean
    admin?: boolean
  }, ExtArgs["result"]["shtat"]>

  export type shtatSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    shtat?: boolean
    market?: boolean
    scan_bild?: boolean
    red_izd?: boolean
    design?: boolean
    lit_baz?: boolean
    admin?: boolean
  }, ExtArgs["result"]["shtat"]>

  export type shtatSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    shtat?: boolean
    market?: boolean
    scan_bild?: boolean
    red_izd?: boolean
    design?: boolean
    lit_baz?: boolean
    admin?: boolean
  }, ExtArgs["result"]["shtat"]>

  export type shtatSelectScalar = {
    id?: boolean
    user_id?: boolean
    shtat?: boolean
    market?: boolean
    scan_bild?: boolean
    red_izd?: boolean
    design?: boolean
    lit_baz?: boolean
    admin?: boolean
  }

  export type shtatOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "shtat" | "market" | "scan_bild" | "red_izd" | "design" | "lit_baz" | "admin", ExtArgs["result"]["shtat"]>

  export type $shtatPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "shtat"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      user_id: bigint
      shtat: number
      market: bigint
      scan_bild: string
      red_izd: string
      design: bigint
      lit_baz: number
      admin: boolean
    }, ExtArgs["result"]["shtat"]>
    composites: {}
  }

  type shtatGetPayload<S extends boolean | null | undefined | shtatDefaultArgs> = $Result.GetResult<Prisma.$shtatPayload, S>

  type shtatCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<shtatFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ShtatCountAggregateInputType | true
    }

  export interface shtatDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['shtat'], meta: { name: 'shtat' } }
    /**
     * Find zero or one Shtat that matches the filter.
     * @param {shtatFindUniqueArgs} args - Arguments to find a Shtat
     * @example
     * // Get one Shtat
     * const shtat = await prisma.shtat.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends shtatFindUniqueArgs>(args: SelectSubset<T, shtatFindUniqueArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Shtat that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {shtatFindUniqueOrThrowArgs} args - Arguments to find a Shtat
     * @example
     * // Get one Shtat
     * const shtat = await prisma.shtat.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends shtatFindUniqueOrThrowArgs>(args: SelectSubset<T, shtatFindUniqueOrThrowArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Shtat that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatFindFirstArgs} args - Arguments to find a Shtat
     * @example
     * // Get one Shtat
     * const shtat = await prisma.shtat.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends shtatFindFirstArgs>(args?: SelectSubset<T, shtatFindFirstArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Shtat that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatFindFirstOrThrowArgs} args - Arguments to find a Shtat
     * @example
     * // Get one Shtat
     * const shtat = await prisma.shtat.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends shtatFindFirstOrThrowArgs>(args?: SelectSubset<T, shtatFindFirstOrThrowArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Shtats that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Shtats
     * const shtats = await prisma.shtat.findMany()
     * 
     * // Get first 10 Shtats
     * const shtats = await prisma.shtat.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const shtatWithIdOnly = await prisma.shtat.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends shtatFindManyArgs>(args?: SelectSubset<T, shtatFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Shtat.
     * @param {shtatCreateArgs} args - Arguments to create a Shtat.
     * @example
     * // Create one Shtat
     * const Shtat = await prisma.shtat.create({
     *   data: {
     *     // ... data to create a Shtat
     *   }
     * })
     * 
     */
    create<T extends shtatCreateArgs>(args: SelectSubset<T, shtatCreateArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Shtats.
     * @param {shtatCreateManyArgs} args - Arguments to create many Shtats.
     * @example
     * // Create many Shtats
     * const shtat = await prisma.shtat.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends shtatCreateManyArgs>(args?: SelectSubset<T, shtatCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Shtats and returns the data saved in the database.
     * @param {shtatCreateManyAndReturnArgs} args - Arguments to create many Shtats.
     * @example
     * // Create many Shtats
     * const shtat = await prisma.shtat.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Shtats and only return the `id`
     * const shtatWithIdOnly = await prisma.shtat.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends shtatCreateManyAndReturnArgs>(args?: SelectSubset<T, shtatCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Shtat.
     * @param {shtatDeleteArgs} args - Arguments to delete one Shtat.
     * @example
     * // Delete one Shtat
     * const Shtat = await prisma.shtat.delete({
     *   where: {
     *     // ... filter to delete one Shtat
     *   }
     * })
     * 
     */
    delete<T extends shtatDeleteArgs>(args: SelectSubset<T, shtatDeleteArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Shtat.
     * @param {shtatUpdateArgs} args - Arguments to update one Shtat.
     * @example
     * // Update one Shtat
     * const shtat = await prisma.shtat.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends shtatUpdateArgs>(args: SelectSubset<T, shtatUpdateArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Shtats.
     * @param {shtatDeleteManyArgs} args - Arguments to filter Shtats to delete.
     * @example
     * // Delete a few Shtats
     * const { count } = await prisma.shtat.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends shtatDeleteManyArgs>(args?: SelectSubset<T, shtatDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Shtats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Shtats
     * const shtat = await prisma.shtat.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends shtatUpdateManyArgs>(args: SelectSubset<T, shtatUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Shtats and returns the data updated in the database.
     * @param {shtatUpdateManyAndReturnArgs} args - Arguments to update many Shtats.
     * @example
     * // Update many Shtats
     * const shtat = await prisma.shtat.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Shtats and only return the `id`
     * const shtatWithIdOnly = await prisma.shtat.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends shtatUpdateManyAndReturnArgs>(args: SelectSubset<T, shtatUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Shtat.
     * @param {shtatUpsertArgs} args - Arguments to update or create a Shtat.
     * @example
     * // Update or create a Shtat
     * const shtat = await prisma.shtat.upsert({
     *   create: {
     *     // ... data to create a Shtat
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Shtat we want to update
     *   }
     * })
     */
    upsert<T extends shtatUpsertArgs>(args: SelectSubset<T, shtatUpsertArgs<ExtArgs>>): Prisma__shtatClient<$Result.GetResult<Prisma.$shtatPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Shtats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatCountArgs} args - Arguments to filter Shtats to count.
     * @example
     * // Count the number of Shtats
     * const count = await prisma.shtat.count({
     *   where: {
     *     // ... the filter for the Shtats we want to count
     *   }
     * })
    **/
    count<T extends shtatCountArgs>(
      args?: Subset<T, shtatCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ShtatCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Shtat.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ShtatAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ShtatAggregateArgs>(args: Subset<T, ShtatAggregateArgs>): Prisma.PrismaPromise<GetShtatAggregateType<T>>

    /**
     * Group by Shtat.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {shtatGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends shtatGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: shtatGroupByArgs['orderBy'] }
        : { orderBy?: shtatGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, shtatGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetShtatGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the shtat model
   */
  readonly fields: shtatFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for shtat.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__shtatClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the shtat model
   */
  interface shtatFieldRefs {
    readonly id: FieldRef<"shtat", 'BigInt'>
    readonly user_id: FieldRef<"shtat", 'BigInt'>
    readonly shtat: FieldRef<"shtat", 'Int'>
    readonly market: FieldRef<"shtat", 'BigInt'>
    readonly scan_bild: FieldRef<"shtat", 'String'>
    readonly red_izd: FieldRef<"shtat", 'String'>
    readonly design: FieldRef<"shtat", 'BigInt'>
    readonly lit_baz: FieldRef<"shtat", 'Int'>
    readonly admin: FieldRef<"shtat", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * shtat findUnique
   */
  export type shtatFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter, which shtat to fetch.
     */
    where: shtatWhereUniqueInput
  }

  /**
   * shtat findUniqueOrThrow
   */
  export type shtatFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter, which shtat to fetch.
     */
    where: shtatWhereUniqueInput
  }

  /**
   * shtat findFirst
   */
  export type shtatFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter, which shtat to fetch.
     */
    where?: shtatWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shtats to fetch.
     */
    orderBy?: shtatOrderByWithRelationInput | shtatOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for shtats.
     */
    cursor?: shtatWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shtats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shtats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of shtats.
     */
    distinct?: ShtatScalarFieldEnum | ShtatScalarFieldEnum[]
  }

  /**
   * shtat findFirstOrThrow
   */
  export type shtatFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter, which shtat to fetch.
     */
    where?: shtatWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shtats to fetch.
     */
    orderBy?: shtatOrderByWithRelationInput | shtatOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for shtats.
     */
    cursor?: shtatWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shtats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shtats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of shtats.
     */
    distinct?: ShtatScalarFieldEnum | ShtatScalarFieldEnum[]
  }

  /**
   * shtat findMany
   */
  export type shtatFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter, which shtats to fetch.
     */
    where?: shtatWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of shtats to fetch.
     */
    orderBy?: shtatOrderByWithRelationInput | shtatOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing shtats.
     */
    cursor?: shtatWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` shtats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` shtats.
     */
    skip?: number
    distinct?: ShtatScalarFieldEnum | ShtatScalarFieldEnum[]
  }

  /**
   * shtat create
   */
  export type shtatCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * The data needed to create a shtat.
     */
    data: XOR<shtatCreateInput, shtatUncheckedCreateInput>
  }

  /**
   * shtat createMany
   */
  export type shtatCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many shtats.
     */
    data: shtatCreateManyInput | shtatCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * shtat createManyAndReturn
   */
  export type shtatCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * The data used to create many shtats.
     */
    data: shtatCreateManyInput | shtatCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * shtat update
   */
  export type shtatUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * The data needed to update a shtat.
     */
    data: XOR<shtatUpdateInput, shtatUncheckedUpdateInput>
    /**
     * Choose, which shtat to update.
     */
    where: shtatWhereUniqueInput
  }

  /**
   * shtat updateMany
   */
  export type shtatUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update shtats.
     */
    data: XOR<shtatUpdateManyMutationInput, shtatUncheckedUpdateManyInput>
    /**
     * Filter which shtats to update
     */
    where?: shtatWhereInput
    /**
     * Limit how many shtats to update.
     */
    limit?: number
  }

  /**
   * shtat updateManyAndReturn
   */
  export type shtatUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * The data used to update shtats.
     */
    data: XOR<shtatUpdateManyMutationInput, shtatUncheckedUpdateManyInput>
    /**
     * Filter which shtats to update
     */
    where?: shtatWhereInput
    /**
     * Limit how many shtats to update.
     */
    limit?: number
  }

  /**
   * shtat upsert
   */
  export type shtatUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * The filter to search for the shtat to update in case it exists.
     */
    where: shtatWhereUniqueInput
    /**
     * In case the shtat found by the `where` argument doesn't exist, create a new shtat with this data.
     */
    create: XOR<shtatCreateInput, shtatUncheckedCreateInput>
    /**
     * In case the shtat was found with the provided `where` argument, update it with this data.
     */
    update: XOR<shtatUpdateInput, shtatUncheckedUpdateInput>
  }

  /**
   * shtat delete
   */
  export type shtatDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
    /**
     * Filter which shtat to delete.
     */
    where: shtatWhereUniqueInput
  }

  /**
   * shtat deleteMany
   */
  export type shtatDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which shtats to delete
     */
    where?: shtatWhereInput
    /**
     * Limit how many shtats to delete.
     */
    limit?: number
  }

  /**
   * shtat without action
   */
  export type shtatDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the shtat
     */
    select?: shtatSelect<ExtArgs> | null
    /**
     * Omit specific fields from the shtat
     */
    omit?: shtatOmit<ExtArgs> | null
  }


  /**
   * Model tems
   */

  export type AggregateTems = {
    _count: TemsCountAggregateOutputType | null
    _avg: TemsAvgAggregateOutputType | null
    _sum: TemsSumAggregateOutputType | null
    _min: TemsMinAggregateOutputType | null
    _max: TemsMaxAggregateOutputType | null
  }

  export type TemsAvgAggregateOutputType = {
    id: number | null
    cod: number | null
  }

  export type TemsSumAggregateOutputType = {
    id: bigint | null
    cod: bigint | null
  }

  export type TemsMinAggregateOutputType = {
    id: bigint | null
    cod: bigint | null
    name: string | null
  }

  export type TemsMaxAggregateOutputType = {
    id: bigint | null
    cod: bigint | null
    name: string | null
  }

  export type TemsCountAggregateOutputType = {
    id: number
    cod: number
    name: number
    _all: number
  }


  export type TemsAvgAggregateInputType = {
    id?: true
    cod?: true
  }

  export type TemsSumAggregateInputType = {
    id?: true
    cod?: true
  }

  export type TemsMinAggregateInputType = {
    id?: true
    cod?: true
    name?: true
  }

  export type TemsMaxAggregateInputType = {
    id?: true
    cod?: true
    name?: true
  }

  export type TemsCountAggregateInputType = {
    id?: true
    cod?: true
    name?: true
    _all?: true
  }

  export type TemsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which tems to aggregate.
     */
    where?: temsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tems to fetch.
     */
    orderBy?: temsOrderByWithRelationInput | temsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: temsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned tems
    **/
    _count?: true | TemsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TemsAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TemsSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TemsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TemsMaxAggregateInputType
  }

  export type GetTemsAggregateType<T extends TemsAggregateArgs> = {
        [P in keyof T & keyof AggregateTems]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTems[P]>
      : GetScalarType<T[P], AggregateTems[P]>
  }




  export type temsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: temsWhereInput
    orderBy?: temsOrderByWithAggregationInput | temsOrderByWithAggregationInput[]
    by: TemsScalarFieldEnum[] | TemsScalarFieldEnum
    having?: temsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TemsCountAggregateInputType | true
    _avg?: TemsAvgAggregateInputType
    _sum?: TemsSumAggregateInputType
    _min?: TemsMinAggregateInputType
    _max?: TemsMaxAggregateInputType
  }

  export type TemsGroupByOutputType = {
    id: bigint
    cod: bigint
    name: string
    _count: TemsCountAggregateOutputType | null
    _avg: TemsAvgAggregateOutputType | null
    _sum: TemsSumAggregateOutputType | null
    _min: TemsMinAggregateOutputType | null
    _max: TemsMaxAggregateOutputType | null
  }

  type GetTemsGroupByPayload<T extends temsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TemsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TemsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TemsGroupByOutputType[P]>
            : GetScalarType<T[P], TemsGroupByOutputType[P]>
        }
      >
    >


  export type temsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cod?: boolean
    name?: boolean
  }, ExtArgs["result"]["tems"]>

  export type temsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cod?: boolean
    name?: boolean
  }, ExtArgs["result"]["tems"]>

  export type temsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cod?: boolean
    name?: boolean
  }, ExtArgs["result"]["tems"]>

  export type temsSelectScalar = {
    id?: boolean
    cod?: boolean
    name?: boolean
  }

  export type temsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "cod" | "name", ExtArgs["result"]["tems"]>

  export type $temsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "tems"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      cod: bigint
      name: string
    }, ExtArgs["result"]["tems"]>
    composites: {}
  }

  type temsGetPayload<S extends boolean | null | undefined | temsDefaultArgs> = $Result.GetResult<Prisma.$temsPayload, S>

  type temsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<temsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TemsCountAggregateInputType | true
    }

  export interface temsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['tems'], meta: { name: 'tems' } }
    /**
     * Find zero or one Tems that matches the filter.
     * @param {temsFindUniqueArgs} args - Arguments to find a Tems
     * @example
     * // Get one Tems
     * const tems = await prisma.tems.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends temsFindUniqueArgs>(args: SelectSubset<T, temsFindUniqueArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Tems that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {temsFindUniqueOrThrowArgs} args - Arguments to find a Tems
     * @example
     * // Get one Tems
     * const tems = await prisma.tems.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends temsFindUniqueOrThrowArgs>(args: SelectSubset<T, temsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Tems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsFindFirstArgs} args - Arguments to find a Tems
     * @example
     * // Get one Tems
     * const tems = await prisma.tems.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends temsFindFirstArgs>(args?: SelectSubset<T, temsFindFirstArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Tems that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsFindFirstOrThrowArgs} args - Arguments to find a Tems
     * @example
     * // Get one Tems
     * const tems = await prisma.tems.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends temsFindFirstOrThrowArgs>(args?: SelectSubset<T, temsFindFirstOrThrowArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Tems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tems
     * const tems = await prisma.tems.findMany()
     * 
     * // Get first 10 Tems
     * const tems = await prisma.tems.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const temsWithIdOnly = await prisma.tems.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends temsFindManyArgs>(args?: SelectSubset<T, temsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Tems.
     * @param {temsCreateArgs} args - Arguments to create a Tems.
     * @example
     * // Create one Tems
     * const Tems = await prisma.tems.create({
     *   data: {
     *     // ... data to create a Tems
     *   }
     * })
     * 
     */
    create<T extends temsCreateArgs>(args: SelectSubset<T, temsCreateArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Tems.
     * @param {temsCreateManyArgs} args - Arguments to create many Tems.
     * @example
     * // Create many Tems
     * const tems = await prisma.tems.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends temsCreateManyArgs>(args?: SelectSubset<T, temsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Tems and returns the data saved in the database.
     * @param {temsCreateManyAndReturnArgs} args - Arguments to create many Tems.
     * @example
     * // Create many Tems
     * const tems = await prisma.tems.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Tems and only return the `id`
     * const temsWithIdOnly = await prisma.tems.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends temsCreateManyAndReturnArgs>(args?: SelectSubset<T, temsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Tems.
     * @param {temsDeleteArgs} args - Arguments to delete one Tems.
     * @example
     * // Delete one Tems
     * const Tems = await prisma.tems.delete({
     *   where: {
     *     // ... filter to delete one Tems
     *   }
     * })
     * 
     */
    delete<T extends temsDeleteArgs>(args: SelectSubset<T, temsDeleteArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Tems.
     * @param {temsUpdateArgs} args - Arguments to update one Tems.
     * @example
     * // Update one Tems
     * const tems = await prisma.tems.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends temsUpdateArgs>(args: SelectSubset<T, temsUpdateArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Tems.
     * @param {temsDeleteManyArgs} args - Arguments to filter Tems to delete.
     * @example
     * // Delete a few Tems
     * const { count } = await prisma.tems.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends temsDeleteManyArgs>(args?: SelectSubset<T, temsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tems
     * const tems = await prisma.tems.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends temsUpdateManyArgs>(args: SelectSubset<T, temsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tems and returns the data updated in the database.
     * @param {temsUpdateManyAndReturnArgs} args - Arguments to update many Tems.
     * @example
     * // Update many Tems
     * const tems = await prisma.tems.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Tems and only return the `id`
     * const temsWithIdOnly = await prisma.tems.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends temsUpdateManyAndReturnArgs>(args: SelectSubset<T, temsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Tems.
     * @param {temsUpsertArgs} args - Arguments to update or create a Tems.
     * @example
     * // Update or create a Tems
     * const tems = await prisma.tems.upsert({
     *   create: {
     *     // ... data to create a Tems
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Tems we want to update
     *   }
     * })
     */
    upsert<T extends temsUpsertArgs>(args: SelectSubset<T, temsUpsertArgs<ExtArgs>>): Prisma__temsClient<$Result.GetResult<Prisma.$temsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Tems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsCountArgs} args - Arguments to filter Tems to count.
     * @example
     * // Count the number of Tems
     * const count = await prisma.tems.count({
     *   where: {
     *     // ... the filter for the Tems we want to count
     *   }
     * })
    **/
    count<T extends temsCountArgs>(
      args?: Subset<T, temsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TemsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Tems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TemsAggregateArgs>(args: Subset<T, TemsAggregateArgs>): Prisma.PrismaPromise<GetTemsAggregateType<T>>

    /**
     * Group by Tems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {temsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends temsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: temsGroupByArgs['orderBy'] }
        : { orderBy?: temsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, temsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTemsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the tems model
   */
  readonly fields: temsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for tems.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__temsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the tems model
   */
  interface temsFieldRefs {
    readonly id: FieldRef<"tems", 'BigInt'>
    readonly cod: FieldRef<"tems", 'BigInt'>
    readonly name: FieldRef<"tems", 'String'>
  }
    

  // Custom InputTypes
  /**
   * tems findUnique
   */
  export type temsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter, which tems to fetch.
     */
    where: temsWhereUniqueInput
  }

  /**
   * tems findUniqueOrThrow
   */
  export type temsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter, which tems to fetch.
     */
    where: temsWhereUniqueInput
  }

  /**
   * tems findFirst
   */
  export type temsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter, which tems to fetch.
     */
    where?: temsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tems to fetch.
     */
    orderBy?: temsOrderByWithRelationInput | temsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for tems.
     */
    cursor?: temsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of tems.
     */
    distinct?: TemsScalarFieldEnum | TemsScalarFieldEnum[]
  }

  /**
   * tems findFirstOrThrow
   */
  export type temsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter, which tems to fetch.
     */
    where?: temsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tems to fetch.
     */
    orderBy?: temsOrderByWithRelationInput | temsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for tems.
     */
    cursor?: temsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of tems.
     */
    distinct?: TemsScalarFieldEnum | TemsScalarFieldEnum[]
  }

  /**
   * tems findMany
   */
  export type temsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter, which tems to fetch.
     */
    where?: temsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tems to fetch.
     */
    orderBy?: temsOrderByWithRelationInput | temsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing tems.
     */
    cursor?: temsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tems.
     */
    skip?: number
    distinct?: TemsScalarFieldEnum | TemsScalarFieldEnum[]
  }

  /**
   * tems create
   */
  export type temsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * The data needed to create a tems.
     */
    data: XOR<temsCreateInput, temsUncheckedCreateInput>
  }

  /**
   * tems createMany
   */
  export type temsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many tems.
     */
    data: temsCreateManyInput | temsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * tems createManyAndReturn
   */
  export type temsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * The data used to create many tems.
     */
    data: temsCreateManyInput | temsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * tems update
   */
  export type temsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * The data needed to update a tems.
     */
    data: XOR<temsUpdateInput, temsUncheckedUpdateInput>
    /**
     * Choose, which tems to update.
     */
    where: temsWhereUniqueInput
  }

  /**
   * tems updateMany
   */
  export type temsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update tems.
     */
    data: XOR<temsUpdateManyMutationInput, temsUncheckedUpdateManyInput>
    /**
     * Filter which tems to update
     */
    where?: temsWhereInput
    /**
     * Limit how many tems to update.
     */
    limit?: number
  }

  /**
   * tems updateManyAndReturn
   */
  export type temsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * The data used to update tems.
     */
    data: XOR<temsUpdateManyMutationInput, temsUncheckedUpdateManyInput>
    /**
     * Filter which tems to update
     */
    where?: temsWhereInput
    /**
     * Limit how many tems to update.
     */
    limit?: number
  }

  /**
   * tems upsert
   */
  export type temsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * The filter to search for the tems to update in case it exists.
     */
    where: temsWhereUniqueInput
    /**
     * In case the tems found by the `where` argument doesn't exist, create a new tems with this data.
     */
    create: XOR<temsCreateInput, temsUncheckedCreateInput>
    /**
     * In case the tems was found with the provided `where` argument, update it with this data.
     */
    update: XOR<temsUpdateInput, temsUncheckedUpdateInput>
  }

  /**
   * tems delete
   */
  export type temsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
    /**
     * Filter which tems to delete.
     */
    where: temsWhereUniqueInput
  }

  /**
   * tems deleteMany
   */
  export type temsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which tems to delete
     */
    where?: temsWhereInput
    /**
     * Limit how many tems to delete.
     */
    limit?: number
  }

  /**
   * tems without action
   */
  export type temsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the tems
     */
    select?: temsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the tems
     */
    omit?: temsOmit<ExtArgs> | null
  }


  /**
   * Model user
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    id: number | null
  }

  export type UserSumAggregateOutputType = {
    id: bigint | null
  }

  export type UserMinAggregateOutputType = {
    id: bigint | null
    name: string | null
    password: string | null
    menu: string | null
    fio: string | null
    pamd: string | null
    end_free: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: bigint | null
    name: string | null
    password: string | null
    menu: string | null
    fio: string | null
    pamd: string | null
    end_free: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    password: number
    menu: number
    fio: number
    pamd: number
    end_free: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    id?: true
  }

  export type UserSumAggregateInputType = {
    id?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    password?: true
    menu?: true
    fio?: true
    pamd?: true
    end_free?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    password?: true
    menu?: true
    fio?: true
    pamd?: true
    end_free?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    password?: true
    menu?: true
    fio?: true
    pamd?: true
    end_free?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which user to aggregate.
     */
    where?: userWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: userOrderByWithRelationInput | userOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: userWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type userGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: userWhereInput
    orderBy?: userOrderByWithAggregationInput | userOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: userScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: bigint
    name: string
    password: string
    menu: string
    fio: string
    pamd: string
    end_free: Date | null
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends userGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type userSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    password?: boolean
    menu?: boolean
    fio?: boolean
    pamd?: boolean
    end_free?: boolean
  }, ExtArgs["result"]["user"]>

  export type userSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    password?: boolean
    menu?: boolean
    fio?: boolean
    pamd?: boolean
    end_free?: boolean
  }, ExtArgs["result"]["user"]>

  export type userSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    password?: boolean
    menu?: boolean
    fio?: boolean
    pamd?: boolean
    end_free?: boolean
  }, ExtArgs["result"]["user"]>

  export type userSelectScalar = {
    id?: boolean
    name?: boolean
    password?: boolean
    menu?: boolean
    fio?: boolean
    pamd?: boolean
    end_free?: boolean
  }

  export type userOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "password" | "menu" | "fio" | "pamd" | "end_free", ExtArgs["result"]["user"]>

  export type $userPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "user"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      name: string
      password: string
      menu: string
      fio: string
      pamd: string
      end_free: Date | null
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type userGetPayload<S extends boolean | null | undefined | userDefaultArgs> = $Result.GetResult<Prisma.$userPayload, S>

  type userCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<userFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface userDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['user'], meta: { name: 'user' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {userFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends userFindUniqueArgs>(args: SelectSubset<T, userFindUniqueArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {userFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends userFindUniqueOrThrowArgs>(args: SelectSubset<T, userFindUniqueOrThrowArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends userFindFirstArgs>(args?: SelectSubset<T, userFindFirstArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends userFindFirstOrThrowArgs>(args?: SelectSubset<T, userFindFirstOrThrowArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends userFindManyArgs>(args?: SelectSubset<T, userFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {userCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends userCreateArgs>(args: SelectSubset<T, userCreateArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {userCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends userCreateManyArgs>(args?: SelectSubset<T, userCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {userCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends userCreateManyAndReturnArgs>(args?: SelectSubset<T, userCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {userDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends userDeleteArgs>(args: SelectSubset<T, userDeleteArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {userUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends userUpdateArgs>(args: SelectSubset<T, userUpdateArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {userDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends userDeleteManyArgs>(args?: SelectSubset<T, userDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends userUpdateManyArgs>(args: SelectSubset<T, userUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {userUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends userUpdateManyAndReturnArgs>(args: SelectSubset<T, userUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {userUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends userUpsertArgs>(args: SelectSubset<T, userUpsertArgs<ExtArgs>>): Prisma__userClient<$Result.GetResult<Prisma.$userPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends userCountArgs>(
      args?: Subset<T, userCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {userGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends userGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: userGroupByArgs['orderBy'] }
        : { orderBy?: userGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, userGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the user model
   */
  readonly fields: userFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for user.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__userClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the user model
   */
  interface userFieldRefs {
    readonly id: FieldRef<"user", 'BigInt'>
    readonly name: FieldRef<"user", 'String'>
    readonly password: FieldRef<"user", 'String'>
    readonly menu: FieldRef<"user", 'String'>
    readonly fio: FieldRef<"user", 'String'>
    readonly pamd: FieldRef<"user", 'String'>
    readonly end_free: FieldRef<"user", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * user findUnique
   */
  export type userFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter, which user to fetch.
     */
    where: userWhereUniqueInput
  }

  /**
   * user findUniqueOrThrow
   */
  export type userFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter, which user to fetch.
     */
    where: userWhereUniqueInput
  }

  /**
   * user findFirst
   */
  export type userFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter, which user to fetch.
     */
    where?: userWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: userOrderByWithRelationInput | userOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for users.
     */
    cursor?: userWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * user findFirstOrThrow
   */
  export type userFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter, which user to fetch.
     */
    where?: userWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: userOrderByWithRelationInput | userOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for users.
     */
    cursor?: userWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * user findMany
   */
  export type userFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where?: userWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: userOrderByWithRelationInput | userOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing users.
     */
    cursor?: userWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * user create
   */
  export type userCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * The data needed to create a user.
     */
    data: XOR<userCreateInput, userUncheckedCreateInput>
  }

  /**
   * user createMany
   */
  export type userCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many users.
     */
    data: userCreateManyInput | userCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * user createManyAndReturn
   */
  export type userCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * The data used to create many users.
     */
    data: userCreateManyInput | userCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * user update
   */
  export type userUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * The data needed to update a user.
     */
    data: XOR<userUpdateInput, userUncheckedUpdateInput>
    /**
     * Choose, which user to update.
     */
    where: userWhereUniqueInput
  }

  /**
   * user updateMany
   */
  export type userUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update users.
     */
    data: XOR<userUpdateManyMutationInput, userUncheckedUpdateManyInput>
    /**
     * Filter which users to update
     */
    where?: userWhereInput
    /**
     * Limit how many users to update.
     */
    limit?: number
  }

  /**
   * user updateManyAndReturn
   */
  export type userUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * The data used to update users.
     */
    data: XOR<userUpdateManyMutationInput, userUncheckedUpdateManyInput>
    /**
     * Filter which users to update
     */
    where?: userWhereInput
    /**
     * Limit how many users to update.
     */
    limit?: number
  }

  /**
   * user upsert
   */
  export type userUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * The filter to search for the user to update in case it exists.
     */
    where: userWhereUniqueInput
    /**
     * In case the user found by the `where` argument doesn't exist, create a new user with this data.
     */
    create: XOR<userCreateInput, userUncheckedCreateInput>
    /**
     * In case the user was found with the provided `where` argument, update it with this data.
     */
    update: XOR<userUpdateInput, userUncheckedUpdateInput>
  }

  /**
   * user delete
   */
  export type userDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
    /**
     * Filter which user to delete.
     */
    where: userWhereUniqueInput
  }

  /**
   * user deleteMany
   */
  export type userDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which users to delete
     */
    where?: userWhereInput
    /**
     * Limit how many users to delete.
     */
    limit?: number
  }

  /**
   * user without action
   */
  export type userDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user
     */
    select?: userSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user
     */
    omit?: userOmit<ExtArgs> | null
  }


  /**
   * Model word_group
   */

  export type AggregateWord_group = {
    _count: Word_groupCountAggregateOutputType | null
    _avg: Word_groupAvgAggregateOutputType | null
    _sum: Word_groupSumAggregateOutputType | null
    _min: Word_groupMinAggregateOutputType | null
    _max: Word_groupMaxAggregateOutputType | null
  }

  export type Word_groupAvgAggregateOutputType = {
    id: number | null
  }

  export type Word_groupSumAggregateOutputType = {
    id: bigint | null
  }

  export type Word_groupMinAggregateOutputType = {
    id: bigint | null
    text_word: string | null
  }

  export type Word_groupMaxAggregateOutputType = {
    id: bigint | null
    text_word: string | null
  }

  export type Word_groupCountAggregateOutputType = {
    id: number
    text_word: number
    _all: number
  }


  export type Word_groupAvgAggregateInputType = {
    id?: true
  }

  export type Word_groupSumAggregateInputType = {
    id?: true
  }

  export type Word_groupMinAggregateInputType = {
    id?: true
    text_word?: true
  }

  export type Word_groupMaxAggregateInputType = {
    id?: true
    text_word?: true
  }

  export type Word_groupCountAggregateInputType = {
    id?: true
    text_word?: true
    _all?: true
  }

  export type Word_groupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which word_group to aggregate.
     */
    where?: word_groupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of word_groups to fetch.
     */
    orderBy?: word_groupOrderByWithRelationInput | word_groupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: word_groupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` word_groups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` word_groups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned word_groups
    **/
    _count?: true | Word_groupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Word_groupAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Word_groupSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Word_groupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Word_groupMaxAggregateInputType
  }

  export type GetWord_groupAggregateType<T extends Word_groupAggregateArgs> = {
        [P in keyof T & keyof AggregateWord_group]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWord_group[P]>
      : GetScalarType<T[P], AggregateWord_group[P]>
  }




  export type word_groupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: word_groupWhereInput
    orderBy?: word_groupOrderByWithAggregationInput | word_groupOrderByWithAggregationInput[]
    by: Word_groupScalarFieldEnum[] | Word_groupScalarFieldEnum
    having?: word_groupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Word_groupCountAggregateInputType | true
    _avg?: Word_groupAvgAggregateInputType
    _sum?: Word_groupSumAggregateInputType
    _min?: Word_groupMinAggregateInputType
    _max?: Word_groupMaxAggregateInputType
  }

  export type Word_groupGroupByOutputType = {
    id: bigint
    text_word: string
    _count: Word_groupCountAggregateOutputType | null
    _avg: Word_groupAvgAggregateOutputType | null
    _sum: Word_groupSumAggregateOutputType | null
    _min: Word_groupMinAggregateOutputType | null
    _max: Word_groupMaxAggregateOutputType | null
  }

  type GetWord_groupGroupByPayload<T extends word_groupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Word_groupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Word_groupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Word_groupGroupByOutputType[P]>
            : GetScalarType<T[P], Word_groupGroupByOutputType[P]>
        }
      >
    >


  export type word_groupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    text_word?: boolean
  }, ExtArgs["result"]["word_group"]>

  export type word_groupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    text_word?: boolean
  }, ExtArgs["result"]["word_group"]>

  export type word_groupSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    text_word?: boolean
  }, ExtArgs["result"]["word_group"]>

  export type word_groupSelectScalar = {
    id?: boolean
    text_word?: boolean
  }

  export type word_groupOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "text_word", ExtArgs["result"]["word_group"]>

  export type $word_groupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "word_group"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      text_word: string
    }, ExtArgs["result"]["word_group"]>
    composites: {}
  }

  type word_groupGetPayload<S extends boolean | null | undefined | word_groupDefaultArgs> = $Result.GetResult<Prisma.$word_groupPayload, S>

  type word_groupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<word_groupFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Word_groupCountAggregateInputType | true
    }

  export interface word_groupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['word_group'], meta: { name: 'word_group' } }
    /**
     * Find zero or one Word_group that matches the filter.
     * @param {word_groupFindUniqueArgs} args - Arguments to find a Word_group
     * @example
     * // Get one Word_group
     * const word_group = await prisma.word_group.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends word_groupFindUniqueArgs>(args: SelectSubset<T, word_groupFindUniqueArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Word_group that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {word_groupFindUniqueOrThrowArgs} args - Arguments to find a Word_group
     * @example
     * // Get one Word_group
     * const word_group = await prisma.word_group.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends word_groupFindUniqueOrThrowArgs>(args: SelectSubset<T, word_groupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Word_group that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupFindFirstArgs} args - Arguments to find a Word_group
     * @example
     * // Get one Word_group
     * const word_group = await prisma.word_group.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends word_groupFindFirstArgs>(args?: SelectSubset<T, word_groupFindFirstArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Word_group that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupFindFirstOrThrowArgs} args - Arguments to find a Word_group
     * @example
     * // Get one Word_group
     * const word_group = await prisma.word_group.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends word_groupFindFirstOrThrowArgs>(args?: SelectSubset<T, word_groupFindFirstOrThrowArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Word_groups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Word_groups
     * const word_groups = await prisma.word_group.findMany()
     * 
     * // Get first 10 Word_groups
     * const word_groups = await prisma.word_group.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const word_groupWithIdOnly = await prisma.word_group.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends word_groupFindManyArgs>(args?: SelectSubset<T, word_groupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Word_group.
     * @param {word_groupCreateArgs} args - Arguments to create a Word_group.
     * @example
     * // Create one Word_group
     * const Word_group = await prisma.word_group.create({
     *   data: {
     *     // ... data to create a Word_group
     *   }
     * })
     * 
     */
    create<T extends word_groupCreateArgs>(args: SelectSubset<T, word_groupCreateArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Word_groups.
     * @param {word_groupCreateManyArgs} args - Arguments to create many Word_groups.
     * @example
     * // Create many Word_groups
     * const word_group = await prisma.word_group.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends word_groupCreateManyArgs>(args?: SelectSubset<T, word_groupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Word_groups and returns the data saved in the database.
     * @param {word_groupCreateManyAndReturnArgs} args - Arguments to create many Word_groups.
     * @example
     * // Create many Word_groups
     * const word_group = await prisma.word_group.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Word_groups and only return the `id`
     * const word_groupWithIdOnly = await prisma.word_group.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends word_groupCreateManyAndReturnArgs>(args?: SelectSubset<T, word_groupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Word_group.
     * @param {word_groupDeleteArgs} args - Arguments to delete one Word_group.
     * @example
     * // Delete one Word_group
     * const Word_group = await prisma.word_group.delete({
     *   where: {
     *     // ... filter to delete one Word_group
     *   }
     * })
     * 
     */
    delete<T extends word_groupDeleteArgs>(args: SelectSubset<T, word_groupDeleteArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Word_group.
     * @param {word_groupUpdateArgs} args - Arguments to update one Word_group.
     * @example
     * // Update one Word_group
     * const word_group = await prisma.word_group.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends word_groupUpdateArgs>(args: SelectSubset<T, word_groupUpdateArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Word_groups.
     * @param {word_groupDeleteManyArgs} args - Arguments to filter Word_groups to delete.
     * @example
     * // Delete a few Word_groups
     * const { count } = await prisma.word_group.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends word_groupDeleteManyArgs>(args?: SelectSubset<T, word_groupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Word_groups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Word_groups
     * const word_group = await prisma.word_group.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends word_groupUpdateManyArgs>(args: SelectSubset<T, word_groupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Word_groups and returns the data updated in the database.
     * @param {word_groupUpdateManyAndReturnArgs} args - Arguments to update many Word_groups.
     * @example
     * // Update many Word_groups
     * const word_group = await prisma.word_group.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Word_groups and only return the `id`
     * const word_groupWithIdOnly = await prisma.word_group.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends word_groupUpdateManyAndReturnArgs>(args: SelectSubset<T, word_groupUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Word_group.
     * @param {word_groupUpsertArgs} args - Arguments to update or create a Word_group.
     * @example
     * // Update or create a Word_group
     * const word_group = await prisma.word_group.upsert({
     *   create: {
     *     // ... data to create a Word_group
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Word_group we want to update
     *   }
     * })
     */
    upsert<T extends word_groupUpsertArgs>(args: SelectSubset<T, word_groupUpsertArgs<ExtArgs>>): Prisma__word_groupClient<$Result.GetResult<Prisma.$word_groupPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Word_groups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupCountArgs} args - Arguments to filter Word_groups to count.
     * @example
     * // Count the number of Word_groups
     * const count = await prisma.word_group.count({
     *   where: {
     *     // ... the filter for the Word_groups we want to count
     *   }
     * })
    **/
    count<T extends word_groupCountArgs>(
      args?: Subset<T, word_groupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Word_groupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Word_group.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Word_groupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Word_groupAggregateArgs>(args: Subset<T, Word_groupAggregateArgs>): Prisma.PrismaPromise<GetWord_groupAggregateType<T>>

    /**
     * Group by Word_group.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {word_groupGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends word_groupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: word_groupGroupByArgs['orderBy'] }
        : { orderBy?: word_groupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, word_groupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWord_groupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the word_group model
   */
  readonly fields: word_groupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for word_group.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__word_groupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the word_group model
   */
  interface word_groupFieldRefs {
    readonly id: FieldRef<"word_group", 'BigInt'>
    readonly text_word: FieldRef<"word_group", 'String'>
  }
    

  // Custom InputTypes
  /**
   * word_group findUnique
   */
  export type word_groupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter, which word_group to fetch.
     */
    where: word_groupWhereUniqueInput
  }

  /**
   * word_group findUniqueOrThrow
   */
  export type word_groupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter, which word_group to fetch.
     */
    where: word_groupWhereUniqueInput
  }

  /**
   * word_group findFirst
   */
  export type word_groupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter, which word_group to fetch.
     */
    where?: word_groupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of word_groups to fetch.
     */
    orderBy?: word_groupOrderByWithRelationInput | word_groupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for word_groups.
     */
    cursor?: word_groupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` word_groups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` word_groups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of word_groups.
     */
    distinct?: Word_groupScalarFieldEnum | Word_groupScalarFieldEnum[]
  }

  /**
   * word_group findFirstOrThrow
   */
  export type word_groupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter, which word_group to fetch.
     */
    where?: word_groupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of word_groups to fetch.
     */
    orderBy?: word_groupOrderByWithRelationInput | word_groupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for word_groups.
     */
    cursor?: word_groupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` word_groups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` word_groups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of word_groups.
     */
    distinct?: Word_groupScalarFieldEnum | Word_groupScalarFieldEnum[]
  }

  /**
   * word_group findMany
   */
  export type word_groupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter, which word_groups to fetch.
     */
    where?: word_groupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of word_groups to fetch.
     */
    orderBy?: word_groupOrderByWithRelationInput | word_groupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing word_groups.
     */
    cursor?: word_groupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` word_groups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` word_groups.
     */
    skip?: number
    distinct?: Word_groupScalarFieldEnum | Word_groupScalarFieldEnum[]
  }

  /**
   * word_group create
   */
  export type word_groupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * The data needed to create a word_group.
     */
    data: XOR<word_groupCreateInput, word_groupUncheckedCreateInput>
  }

  /**
   * word_group createMany
   */
  export type word_groupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many word_groups.
     */
    data: word_groupCreateManyInput | word_groupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * word_group createManyAndReturn
   */
  export type word_groupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * The data used to create many word_groups.
     */
    data: word_groupCreateManyInput | word_groupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * word_group update
   */
  export type word_groupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * The data needed to update a word_group.
     */
    data: XOR<word_groupUpdateInput, word_groupUncheckedUpdateInput>
    /**
     * Choose, which word_group to update.
     */
    where: word_groupWhereUniqueInput
  }

  /**
   * word_group updateMany
   */
  export type word_groupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update word_groups.
     */
    data: XOR<word_groupUpdateManyMutationInput, word_groupUncheckedUpdateManyInput>
    /**
     * Filter which word_groups to update
     */
    where?: word_groupWhereInput
    /**
     * Limit how many word_groups to update.
     */
    limit?: number
  }

  /**
   * word_group updateManyAndReturn
   */
  export type word_groupUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * The data used to update word_groups.
     */
    data: XOR<word_groupUpdateManyMutationInput, word_groupUncheckedUpdateManyInput>
    /**
     * Filter which word_groups to update
     */
    where?: word_groupWhereInput
    /**
     * Limit how many word_groups to update.
     */
    limit?: number
  }

  /**
   * word_group upsert
   */
  export type word_groupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * The filter to search for the word_group to update in case it exists.
     */
    where: word_groupWhereUniqueInput
    /**
     * In case the word_group found by the `where` argument doesn't exist, create a new word_group with this data.
     */
    create: XOR<word_groupCreateInput, word_groupUncheckedCreateInput>
    /**
     * In case the word_group was found with the provided `where` argument, update it with this data.
     */
    update: XOR<word_groupUpdateInput, word_groupUncheckedUpdateInput>
  }

  /**
   * word_group delete
   */
  export type word_groupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
    /**
     * Filter which word_group to delete.
     */
    where: word_groupWhereUniqueInput
  }

  /**
   * word_group deleteMany
   */
  export type word_groupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which word_groups to delete
     */
    where?: word_groupWhereInput
    /**
     * Limit how many word_groups to delete.
     */
    limit?: number
  }

  /**
   * word_group without action
   */
  export type word_groupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the word_group
     */
    select?: word_groupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the word_group
     */
    omit?: word_groupOmit<ExtArgs> | null
  }


  /**
   * Model words_v
   */

  export type AggregateWords_v = {
    _count: Words_vCountAggregateOutputType | null
    _avg: Words_vAvgAggregateOutputType | null
    _sum: Words_vSumAggregateOutputType | null
    _min: Words_vMinAggregateOutputType | null
    _max: Words_vMaxAggregateOutputType | null
  }

  export type Words_vAvgAggregateOutputType = {
    id: number | null
    key_word: number | null
    skan: number | null
    word_group: number | null
    back_id: number | null
    word_length: number | null
  }

  export type Words_vSumAggregateOutputType = {
    id: bigint | null
    key_word: number | null
    skan: number | null
    word_group: bigint | null
    back_id: bigint | null
    word_length: number | null
  }

  export type Words_vMinAggregateOutputType = {
    id: bigint | null
    word_text: string | null
    lingv: string | null
    key_word: number | null
    skan: number | null
    word_group: bigint | null
    foto: string | null
    back_id: bigint | null
    word_length: number | null
  }

  export type Words_vMaxAggregateOutputType = {
    id: bigint | null
    word_text: string | null
    lingv: string | null
    key_word: number | null
    skan: number | null
    word_group: bigint | null
    foto: string | null
    back_id: bigint | null
    word_length: number | null
  }

  export type Words_vCountAggregateOutputType = {
    id: number
    word_text: number
    lingv: number
    key_word: number
    skan: number
    word_group: number
    foto: number
    back_id: number
    word_length: number
    _all: number
  }


  export type Words_vAvgAggregateInputType = {
    id?: true
    key_word?: true
    skan?: true
    word_group?: true
    back_id?: true
    word_length?: true
  }

  export type Words_vSumAggregateInputType = {
    id?: true
    key_word?: true
    skan?: true
    word_group?: true
    back_id?: true
    word_length?: true
  }

  export type Words_vMinAggregateInputType = {
    id?: true
    word_text?: true
    lingv?: true
    key_word?: true
    skan?: true
    word_group?: true
    foto?: true
    back_id?: true
    word_length?: true
  }

  export type Words_vMaxAggregateInputType = {
    id?: true
    word_text?: true
    lingv?: true
    key_word?: true
    skan?: true
    word_group?: true
    foto?: true
    back_id?: true
    word_length?: true
  }

  export type Words_vCountAggregateInputType = {
    id?: true
    word_text?: true
    lingv?: true
    key_word?: true
    skan?: true
    word_group?: true
    foto?: true
    back_id?: true
    word_length?: true
    _all?: true
  }

  export type Words_vAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which words_v to aggregate.
     */
    where?: words_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of words_vs to fetch.
     */
    orderBy?: words_vOrderByWithRelationInput | words_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: words_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` words_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` words_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned words_vs
    **/
    _count?: true | Words_vCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Words_vAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Words_vSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Words_vMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Words_vMaxAggregateInputType
  }

  export type GetWords_vAggregateType<T extends Words_vAggregateArgs> = {
        [P in keyof T & keyof AggregateWords_v]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWords_v[P]>
      : GetScalarType<T[P], AggregateWords_v[P]>
  }




  export type words_vGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: words_vWhereInput
    orderBy?: words_vOrderByWithAggregationInput | words_vOrderByWithAggregationInput[]
    by: Words_vScalarFieldEnum[] | Words_vScalarFieldEnum
    having?: words_vScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Words_vCountAggregateInputType | true
    _avg?: Words_vAvgAggregateInputType
    _sum?: Words_vSumAggregateInputType
    _min?: Words_vMinAggregateInputType
    _max?: Words_vMaxAggregateInputType
  }

  export type Words_vGroupByOutputType = {
    id: bigint
    word_text: string
    lingv: string
    key_word: number
    skan: number
    word_group: bigint
    foto: string
    back_id: bigint
    word_length: number
    _count: Words_vCountAggregateOutputType | null
    _avg: Words_vAvgAggregateOutputType | null
    _sum: Words_vSumAggregateOutputType | null
    _min: Words_vMinAggregateOutputType | null
    _max: Words_vMaxAggregateOutputType | null
  }

  type GetWords_vGroupByPayload<T extends words_vGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Words_vGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Words_vGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Words_vGroupByOutputType[P]>
            : GetScalarType<T[P], Words_vGroupByOutputType[P]>
        }
      >
    >


  export type words_vSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_text?: boolean
    lingv?: boolean
    key_word?: boolean
    skan?: boolean
    word_group?: boolean
    foto?: boolean
    back_id?: boolean
    word_length?: boolean
  }, ExtArgs["result"]["words_v"]>

  export type words_vSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_text?: boolean
    lingv?: boolean
    key_word?: boolean
    skan?: boolean
    word_group?: boolean
    foto?: boolean
    back_id?: boolean
    word_length?: boolean
  }, ExtArgs["result"]["words_v"]>

  export type words_vSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    word_text?: boolean
    lingv?: boolean
    key_word?: boolean
    skan?: boolean
    word_group?: boolean
    foto?: boolean
    back_id?: boolean
    word_length?: boolean
  }, ExtArgs["result"]["words_v"]>

  export type words_vSelectScalar = {
    id?: boolean
    word_text?: boolean
    lingv?: boolean
    key_word?: boolean
    skan?: boolean
    word_group?: boolean
    foto?: boolean
    back_id?: boolean
    word_length?: boolean
  }

  export type words_vOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "word_text" | "lingv" | "key_word" | "skan" | "word_group" | "foto" | "back_id" | "word_length", ExtArgs["result"]["words_v"]>

  export type $words_vPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "words_v"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      word_text: string
      lingv: string
      key_word: number
      skan: number
      word_group: bigint
      foto: string
      back_id: bigint
      word_length: number
    }, ExtArgs["result"]["words_v"]>
    composites: {}
  }

  type words_vGetPayload<S extends boolean | null | undefined | words_vDefaultArgs> = $Result.GetResult<Prisma.$words_vPayload, S>

  type words_vCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<words_vFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Words_vCountAggregateInputType | true
    }

  export interface words_vDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['words_v'], meta: { name: 'words_v' } }
    /**
     * Find zero or one Words_v that matches the filter.
     * @param {words_vFindUniqueArgs} args - Arguments to find a Words_v
     * @example
     * // Get one Words_v
     * const words_v = await prisma.words_v.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends words_vFindUniqueArgs>(args: SelectSubset<T, words_vFindUniqueArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Words_v that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {words_vFindUniqueOrThrowArgs} args - Arguments to find a Words_v
     * @example
     * // Get one Words_v
     * const words_v = await prisma.words_v.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends words_vFindUniqueOrThrowArgs>(args: SelectSubset<T, words_vFindUniqueOrThrowArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Words_v that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vFindFirstArgs} args - Arguments to find a Words_v
     * @example
     * // Get one Words_v
     * const words_v = await prisma.words_v.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends words_vFindFirstArgs>(args?: SelectSubset<T, words_vFindFirstArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Words_v that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vFindFirstOrThrowArgs} args - Arguments to find a Words_v
     * @example
     * // Get one Words_v
     * const words_v = await prisma.words_v.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends words_vFindFirstOrThrowArgs>(args?: SelectSubset<T, words_vFindFirstOrThrowArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Words_vs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Words_vs
     * const words_vs = await prisma.words_v.findMany()
     * 
     * // Get first 10 Words_vs
     * const words_vs = await prisma.words_v.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const words_vWithIdOnly = await prisma.words_v.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends words_vFindManyArgs>(args?: SelectSubset<T, words_vFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Words_v.
     * @param {words_vCreateArgs} args - Arguments to create a Words_v.
     * @example
     * // Create one Words_v
     * const Words_v = await prisma.words_v.create({
     *   data: {
     *     // ... data to create a Words_v
     *   }
     * })
     * 
     */
    create<T extends words_vCreateArgs>(args: SelectSubset<T, words_vCreateArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Words_vs.
     * @param {words_vCreateManyArgs} args - Arguments to create many Words_vs.
     * @example
     * // Create many Words_vs
     * const words_v = await prisma.words_v.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends words_vCreateManyArgs>(args?: SelectSubset<T, words_vCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Words_vs and returns the data saved in the database.
     * @param {words_vCreateManyAndReturnArgs} args - Arguments to create many Words_vs.
     * @example
     * // Create many Words_vs
     * const words_v = await prisma.words_v.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Words_vs and only return the `id`
     * const words_vWithIdOnly = await prisma.words_v.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends words_vCreateManyAndReturnArgs>(args?: SelectSubset<T, words_vCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Words_v.
     * @param {words_vDeleteArgs} args - Arguments to delete one Words_v.
     * @example
     * // Delete one Words_v
     * const Words_v = await prisma.words_v.delete({
     *   where: {
     *     // ... filter to delete one Words_v
     *   }
     * })
     * 
     */
    delete<T extends words_vDeleteArgs>(args: SelectSubset<T, words_vDeleteArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Words_v.
     * @param {words_vUpdateArgs} args - Arguments to update one Words_v.
     * @example
     * // Update one Words_v
     * const words_v = await prisma.words_v.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends words_vUpdateArgs>(args: SelectSubset<T, words_vUpdateArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Words_vs.
     * @param {words_vDeleteManyArgs} args - Arguments to filter Words_vs to delete.
     * @example
     * // Delete a few Words_vs
     * const { count } = await prisma.words_v.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends words_vDeleteManyArgs>(args?: SelectSubset<T, words_vDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Words_vs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Words_vs
     * const words_v = await prisma.words_v.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends words_vUpdateManyArgs>(args: SelectSubset<T, words_vUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Words_vs and returns the data updated in the database.
     * @param {words_vUpdateManyAndReturnArgs} args - Arguments to update many Words_vs.
     * @example
     * // Update many Words_vs
     * const words_v = await prisma.words_v.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Words_vs and only return the `id`
     * const words_vWithIdOnly = await prisma.words_v.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends words_vUpdateManyAndReturnArgs>(args: SelectSubset<T, words_vUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Words_v.
     * @param {words_vUpsertArgs} args - Arguments to update or create a Words_v.
     * @example
     * // Update or create a Words_v
     * const words_v = await prisma.words_v.upsert({
     *   create: {
     *     // ... data to create a Words_v
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Words_v we want to update
     *   }
     * })
     */
    upsert<T extends words_vUpsertArgs>(args: SelectSubset<T, words_vUpsertArgs<ExtArgs>>): Prisma__words_vClient<$Result.GetResult<Prisma.$words_vPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Words_vs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vCountArgs} args - Arguments to filter Words_vs to count.
     * @example
     * // Count the number of Words_vs
     * const count = await prisma.words_v.count({
     *   where: {
     *     // ... the filter for the Words_vs we want to count
     *   }
     * })
    **/
    count<T extends words_vCountArgs>(
      args?: Subset<T, words_vCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Words_vCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Words_v.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Words_vAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Words_vAggregateArgs>(args: Subset<T, Words_vAggregateArgs>): Prisma.PrismaPromise<GetWords_vAggregateType<T>>

    /**
     * Group by Words_v.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {words_vGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends words_vGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: words_vGroupByArgs['orderBy'] }
        : { orderBy?: words_vGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, words_vGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWords_vGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the words_v model
   */
  readonly fields: words_vFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for words_v.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__words_vClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the words_v model
   */
  interface words_vFieldRefs {
    readonly id: FieldRef<"words_v", 'BigInt'>
    readonly word_text: FieldRef<"words_v", 'String'>
    readonly lingv: FieldRef<"words_v", 'String'>
    readonly key_word: FieldRef<"words_v", 'Int'>
    readonly skan: FieldRef<"words_v", 'Int'>
    readonly word_group: FieldRef<"words_v", 'BigInt'>
    readonly foto: FieldRef<"words_v", 'String'>
    readonly back_id: FieldRef<"words_v", 'BigInt'>
    readonly word_length: FieldRef<"words_v", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * words_v findUnique
   */
  export type words_vFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter, which words_v to fetch.
     */
    where: words_vWhereUniqueInput
  }

  /**
   * words_v findUniqueOrThrow
   */
  export type words_vFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter, which words_v to fetch.
     */
    where: words_vWhereUniqueInput
  }

  /**
   * words_v findFirst
   */
  export type words_vFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter, which words_v to fetch.
     */
    where?: words_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of words_vs to fetch.
     */
    orderBy?: words_vOrderByWithRelationInput | words_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for words_vs.
     */
    cursor?: words_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` words_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` words_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of words_vs.
     */
    distinct?: Words_vScalarFieldEnum | Words_vScalarFieldEnum[]
  }

  /**
   * words_v findFirstOrThrow
   */
  export type words_vFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter, which words_v to fetch.
     */
    where?: words_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of words_vs to fetch.
     */
    orderBy?: words_vOrderByWithRelationInput | words_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for words_vs.
     */
    cursor?: words_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` words_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` words_vs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of words_vs.
     */
    distinct?: Words_vScalarFieldEnum | Words_vScalarFieldEnum[]
  }

  /**
   * words_v findMany
   */
  export type words_vFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter, which words_vs to fetch.
     */
    where?: words_vWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of words_vs to fetch.
     */
    orderBy?: words_vOrderByWithRelationInput | words_vOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing words_vs.
     */
    cursor?: words_vWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` words_vs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` words_vs.
     */
    skip?: number
    distinct?: Words_vScalarFieldEnum | Words_vScalarFieldEnum[]
  }

  /**
   * words_v create
   */
  export type words_vCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * The data needed to create a words_v.
     */
    data: XOR<words_vCreateInput, words_vUncheckedCreateInput>
  }

  /**
   * words_v createMany
   */
  export type words_vCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many words_vs.
     */
    data: words_vCreateManyInput | words_vCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * words_v createManyAndReturn
   */
  export type words_vCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * The data used to create many words_vs.
     */
    data: words_vCreateManyInput | words_vCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * words_v update
   */
  export type words_vUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * The data needed to update a words_v.
     */
    data: XOR<words_vUpdateInput, words_vUncheckedUpdateInput>
    /**
     * Choose, which words_v to update.
     */
    where: words_vWhereUniqueInput
  }

  /**
   * words_v updateMany
   */
  export type words_vUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update words_vs.
     */
    data: XOR<words_vUpdateManyMutationInput, words_vUncheckedUpdateManyInput>
    /**
     * Filter which words_vs to update
     */
    where?: words_vWhereInput
    /**
     * Limit how many words_vs to update.
     */
    limit?: number
  }

  /**
   * words_v updateManyAndReturn
   */
  export type words_vUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * The data used to update words_vs.
     */
    data: XOR<words_vUpdateManyMutationInput, words_vUncheckedUpdateManyInput>
    /**
     * Filter which words_vs to update
     */
    where?: words_vWhereInput
    /**
     * Limit how many words_vs to update.
     */
    limit?: number
  }

  /**
   * words_v upsert
   */
  export type words_vUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * The filter to search for the words_v to update in case it exists.
     */
    where: words_vWhereUniqueInput
    /**
     * In case the words_v found by the `where` argument doesn't exist, create a new words_v with this data.
     */
    create: XOR<words_vCreateInput, words_vUncheckedCreateInput>
    /**
     * In case the words_v was found with the provided `where` argument, update it with this data.
     */
    update: XOR<words_vUpdateInput, words_vUncheckedUpdateInput>
  }

  /**
   * words_v delete
   */
  export type words_vDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
    /**
     * Filter which words_v to delete.
     */
    where: words_vWhereUniqueInput
  }

  /**
   * words_v deleteMany
   */
  export type words_vDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which words_vs to delete
     */
    where?: words_vWhereInput
    /**
     * Limit how many words_vs to delete.
     */
    limit?: number
  }

  /**
   * words_v without action
   */
  export type words_vDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the words_v
     */
    select?: words_vSelect<ExtArgs> | null
    /**
     * Omit specific fields from the words_v
     */
    omit?: words_vOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const Izd_nameScalarFieldEnum: {
    id: 'id',
    name: 'name',
    redakcia: 'redakcia',
    tabl_name: 'tabl_name',
    add_user: 'add_user',
    add_data: 'add_data'
  };

  export type Izd_nameScalarFieldEnum = (typeof Izd_nameScalarFieldEnum)[keyof typeof Izd_nameScalarFieldEnum]


  export const Number_izdScalarFieldEnum: {
    id: 'id',
    izd_id: 'izd_id',
    curent_id: 'curent_id',
    pub_numb: 'pub_numb'
  };

  export type Number_izdScalarFieldEnum = (typeof Number_izdScalarFieldEnum)[keyof typeof Number_izdScalarFieldEnum]


  export const Opred_vScalarFieldEnum: {
    id: 'id',
    word_id: 'word_id',
    text_opr: 'text_opr',
    end_date: 'end_date',
    lang: 'lang',
    tema: 'tema',
    livel: 'livel',
    w1: 'w1',
    w2: 'w2',
    w3: 'w3',
    id_file: 'id_file',
    use_for_bild: 'use_for_bild',
    user_add: 'user_add',
    add_data: 'add_data',
    edit_user: 'edit_user',
    edit_data: 'edit_data',
    coment: 'coment',
    set_reg: 'set_reg',
    user_set: 'user_set',
    back_id: 'back_id'
  };

  export type Opred_vScalarFieldEnum = (typeof Opred_vScalarFieldEnum)[keyof typeof Opred_vScalarFieldEnum]


  export const PublicationsScalarFieldEnum: {
    id: 'id',
    archive: 'archive',
    num: 'num',
    seq_num: 'seq_num',
    nameid: 'nameid',
    region: 'region',
    level: 'level',
    repeats: 'repeats',
    replacement: 'replacement',
    date: 'date'
  };

  export type PublicationsScalarFieldEnum = (typeof PublicationsScalarFieldEnum)[keyof typeof PublicationsScalarFieldEnum]


  export const ShablonScalarFieldEnum: {
    id: 'id',
    w_pazl: 'w_pazl',
    h_pazl: 'h_pazl',
    foto: 'foto',
    oprd_foto: 'oprd_foto',
    big_cell: 'big_cell',
    hide_cell: 'hide_cell',
    md: 'md',
    type_pazl: 'type_pazl',
    char_mask: 'char_mask',
    use_year: 'use_year',
    use_mon: 'use_mon',
    add_data: 'add_data'
  };

  export type ShablonScalarFieldEnum = (typeof ShablonScalarFieldEnum)[keyof typeof ShablonScalarFieldEnum]


  export const ShtatScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    shtat: 'shtat',
    market: 'market',
    scan_bild: 'scan_bild',
    red_izd: 'red_izd',
    design: 'design',
    lit_baz: 'lit_baz',
    admin: 'admin'
  };

  export type ShtatScalarFieldEnum = (typeof ShtatScalarFieldEnum)[keyof typeof ShtatScalarFieldEnum]


  export const TemsScalarFieldEnum: {
    id: 'id',
    cod: 'cod',
    name: 'name'
  };

  export type TemsScalarFieldEnum = (typeof TemsScalarFieldEnum)[keyof typeof TemsScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    password: 'password',
    menu: 'menu',
    fio: 'fio',
    pamd: 'pamd',
    end_free: 'end_free'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const Word_groupScalarFieldEnum: {
    id: 'id',
    text_word: 'text_word'
  };

  export type Word_groupScalarFieldEnum = (typeof Word_groupScalarFieldEnum)[keyof typeof Word_groupScalarFieldEnum]


  export const Words_vScalarFieldEnum: {
    id: 'id',
    word_text: 'word_text',
    lingv: 'lingv',
    key_word: 'key_word',
    skan: 'skan',
    word_group: 'word_group',
    foto: 'foto',
    back_id: 'back_id',
    word_length: 'word_length'
  };

  export type Words_vScalarFieldEnum = (typeof Words_vScalarFieldEnum)[keyof typeof Words_vScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type izd_nameWhereInput = {
    AND?: izd_nameWhereInput | izd_nameWhereInput[]
    OR?: izd_nameWhereInput[]
    NOT?: izd_nameWhereInput | izd_nameWhereInput[]
    id?: BigIntFilter<"izd_name"> | bigint | number
    name?: StringFilter<"izd_name"> | string
    redakcia?: StringFilter<"izd_name"> | string
    tabl_name?: StringFilter<"izd_name"> | string
    add_user?: StringFilter<"izd_name"> | string
    add_data?: DateTimeNullableFilter<"izd_name"> | Date | string | null
  }

  export type izd_nameOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    redakcia?: SortOrder
    tabl_name?: SortOrder
    add_user?: SortOrder
    add_data?: SortOrderInput | SortOrder
  }

  export type izd_nameWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: izd_nameWhereInput | izd_nameWhereInput[]
    OR?: izd_nameWhereInput[]
    NOT?: izd_nameWhereInput | izd_nameWhereInput[]
    name?: StringFilter<"izd_name"> | string
    redakcia?: StringFilter<"izd_name"> | string
    tabl_name?: StringFilter<"izd_name"> | string
    add_user?: StringFilter<"izd_name"> | string
    add_data?: DateTimeNullableFilter<"izd_name"> | Date | string | null
  }, "id">

  export type izd_nameOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    redakcia?: SortOrder
    tabl_name?: SortOrder
    add_user?: SortOrder
    add_data?: SortOrderInput | SortOrder
    _count?: izd_nameCountOrderByAggregateInput
    _avg?: izd_nameAvgOrderByAggregateInput
    _max?: izd_nameMaxOrderByAggregateInput
    _min?: izd_nameMinOrderByAggregateInput
    _sum?: izd_nameSumOrderByAggregateInput
  }

  export type izd_nameScalarWhereWithAggregatesInput = {
    AND?: izd_nameScalarWhereWithAggregatesInput | izd_nameScalarWhereWithAggregatesInput[]
    OR?: izd_nameScalarWhereWithAggregatesInput[]
    NOT?: izd_nameScalarWhereWithAggregatesInput | izd_nameScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"izd_name"> | bigint | number
    name?: StringWithAggregatesFilter<"izd_name"> | string
    redakcia?: StringWithAggregatesFilter<"izd_name"> | string
    tabl_name?: StringWithAggregatesFilter<"izd_name"> | string
    add_user?: StringWithAggregatesFilter<"izd_name"> | string
    add_data?: DateTimeNullableWithAggregatesFilter<"izd_name"> | Date | string | null
  }

  export type number_izdWhereInput = {
    AND?: number_izdWhereInput | number_izdWhereInput[]
    OR?: number_izdWhereInput[]
    NOT?: number_izdWhereInput | number_izdWhereInput[]
    id?: BigIntFilter<"number_izd"> | bigint | number
    izd_id?: BigIntFilter<"number_izd"> | bigint | number
    curent_id?: BigIntFilter<"number_izd"> | bigint | number
    pub_numb?: StringFilter<"number_izd"> | string
  }

  export type number_izdOrderByWithRelationInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
    pub_numb?: SortOrder
  }

  export type number_izdWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: number_izdWhereInput | number_izdWhereInput[]
    OR?: number_izdWhereInput[]
    NOT?: number_izdWhereInput | number_izdWhereInput[]
    izd_id?: BigIntFilter<"number_izd"> | bigint | number
    curent_id?: BigIntFilter<"number_izd"> | bigint | number
    pub_numb?: StringFilter<"number_izd"> | string
  }, "id">

  export type number_izdOrderByWithAggregationInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
    pub_numb?: SortOrder
    _count?: number_izdCountOrderByAggregateInput
    _avg?: number_izdAvgOrderByAggregateInput
    _max?: number_izdMaxOrderByAggregateInput
    _min?: number_izdMinOrderByAggregateInput
    _sum?: number_izdSumOrderByAggregateInput
  }

  export type number_izdScalarWhereWithAggregatesInput = {
    AND?: number_izdScalarWhereWithAggregatesInput | number_izdScalarWhereWithAggregatesInput[]
    OR?: number_izdScalarWhereWithAggregatesInput[]
    NOT?: number_izdScalarWhereWithAggregatesInput | number_izdScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"number_izd"> | bigint | number
    izd_id?: BigIntWithAggregatesFilter<"number_izd"> | bigint | number
    curent_id?: BigIntWithAggregatesFilter<"number_izd"> | bigint | number
    pub_numb?: StringWithAggregatesFilter<"number_izd"> | string
  }

  export type opred_vWhereInput = {
    AND?: opred_vWhereInput | opred_vWhereInput[]
    OR?: opred_vWhereInput[]
    NOT?: opred_vWhereInput | opred_vWhereInput[]
    id?: BigIntFilter<"opred_v"> | bigint | number
    word_id?: BigIntFilter<"opred_v"> | bigint | number
    text_opr?: StringFilter<"opred_v"> | string
    end_date?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    lang?: StringFilter<"opred_v"> | string
    tema?: BigIntFilter<"opred_v"> | bigint | number
    livel?: IntFilter<"opred_v"> | number
    w1?: IntFilter<"opred_v"> | number
    w2?: IntFilter<"opred_v"> | number
    w3?: IntFilter<"opred_v"> | number
    id_file?: BigIntFilter<"opred_v"> | bigint | number
    use_for_bild?: IntFilter<"opred_v"> | number
    user_add?: StringFilter<"opred_v"> | string
    add_data?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    edit_user?: StringFilter<"opred_v"> | string
    edit_data?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    coment?: StringFilter<"opred_v"> | string
    set_reg?: BigIntFilter<"opred_v"> | bigint | number
    user_set?: StringFilter<"opred_v"> | string
    back_id?: BigIntFilter<"opred_v"> | bigint | number
  }

  export type opred_vOrderByWithRelationInput = {
    id?: SortOrder
    word_id?: SortOrder
    text_opr?: SortOrder
    end_date?: SortOrderInput | SortOrder
    lang?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    user_add?: SortOrder
    add_data?: SortOrderInput | SortOrder
    edit_user?: SortOrder
    edit_data?: SortOrderInput | SortOrder
    coment?: SortOrder
    set_reg?: SortOrder
    user_set?: SortOrder
    back_id?: SortOrder
  }

  export type opred_vWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: opred_vWhereInput | opred_vWhereInput[]
    OR?: opred_vWhereInput[]
    NOT?: opred_vWhereInput | opred_vWhereInput[]
    word_id?: BigIntFilter<"opred_v"> | bigint | number
    text_opr?: StringFilter<"opred_v"> | string
    end_date?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    lang?: StringFilter<"opred_v"> | string
    tema?: BigIntFilter<"opred_v"> | bigint | number
    livel?: IntFilter<"opred_v"> | number
    w1?: IntFilter<"opred_v"> | number
    w2?: IntFilter<"opred_v"> | number
    w3?: IntFilter<"opred_v"> | number
    id_file?: BigIntFilter<"opred_v"> | bigint | number
    use_for_bild?: IntFilter<"opred_v"> | number
    user_add?: StringFilter<"opred_v"> | string
    add_data?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    edit_user?: StringFilter<"opred_v"> | string
    edit_data?: DateTimeNullableFilter<"opred_v"> | Date | string | null
    coment?: StringFilter<"opred_v"> | string
    set_reg?: BigIntFilter<"opred_v"> | bigint | number
    user_set?: StringFilter<"opred_v"> | string
    back_id?: BigIntFilter<"opred_v"> | bigint | number
  }, "id">

  export type opred_vOrderByWithAggregationInput = {
    id?: SortOrder
    word_id?: SortOrder
    text_opr?: SortOrder
    end_date?: SortOrderInput | SortOrder
    lang?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    user_add?: SortOrder
    add_data?: SortOrderInput | SortOrder
    edit_user?: SortOrder
    edit_data?: SortOrderInput | SortOrder
    coment?: SortOrder
    set_reg?: SortOrder
    user_set?: SortOrder
    back_id?: SortOrder
    _count?: opred_vCountOrderByAggregateInput
    _avg?: opred_vAvgOrderByAggregateInput
    _max?: opred_vMaxOrderByAggregateInput
    _min?: opred_vMinOrderByAggregateInput
    _sum?: opred_vSumOrderByAggregateInput
  }

  export type opred_vScalarWhereWithAggregatesInput = {
    AND?: opred_vScalarWhereWithAggregatesInput | opred_vScalarWhereWithAggregatesInput[]
    OR?: opred_vScalarWhereWithAggregatesInput[]
    NOT?: opred_vScalarWhereWithAggregatesInput | opred_vScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
    word_id?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
    text_opr?: StringWithAggregatesFilter<"opred_v"> | string
    end_date?: DateTimeNullableWithAggregatesFilter<"opred_v"> | Date | string | null
    lang?: StringWithAggregatesFilter<"opred_v"> | string
    tema?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
    livel?: IntWithAggregatesFilter<"opred_v"> | number
    w1?: IntWithAggregatesFilter<"opred_v"> | number
    w2?: IntWithAggregatesFilter<"opred_v"> | number
    w3?: IntWithAggregatesFilter<"opred_v"> | number
    id_file?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
    use_for_bild?: IntWithAggregatesFilter<"opred_v"> | number
    user_add?: StringWithAggregatesFilter<"opred_v"> | string
    add_data?: DateTimeNullableWithAggregatesFilter<"opred_v"> | Date | string | null
    edit_user?: StringWithAggregatesFilter<"opred_v"> | string
    edit_data?: DateTimeNullableWithAggregatesFilter<"opred_v"> | Date | string | null
    coment?: StringWithAggregatesFilter<"opred_v"> | string
    set_reg?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
    user_set?: StringWithAggregatesFilter<"opred_v"> | string
    back_id?: BigIntWithAggregatesFilter<"opred_v"> | bigint | number
  }

  export type publicationsWhereInput = {
    AND?: publicationsWhereInput | publicationsWhereInput[]
    OR?: publicationsWhereInput[]
    NOT?: publicationsWhereInput | publicationsWhereInput[]
    id?: BigIntFilter<"publications"> | bigint | number
    archive?: BoolFilter<"publications"> | boolean
    num?: StringFilter<"publications"> | string
    seq_num?: BigIntFilter<"publications"> | bigint | number
    nameid?: BigIntFilter<"publications"> | bigint | number
    region?: StringNullableFilter<"publications"> | string | null
    level?: BigIntNullableFilter<"publications"> | bigint | number | null
    repeats?: BigIntFilter<"publications"> | bigint | number
    replacement?: StringNullableFilter<"publications"> | string | null
    date?: DateTimeNullableFilter<"publications"> | Date | string | null
  }

  export type publicationsOrderByWithRelationInput = {
    id?: SortOrder
    archive?: SortOrder
    num?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    region?: SortOrderInput | SortOrder
    level?: SortOrderInput | SortOrder
    repeats?: SortOrder
    replacement?: SortOrderInput | SortOrder
    date?: SortOrderInput | SortOrder
  }

  export type publicationsWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: publicationsWhereInput | publicationsWhereInput[]
    OR?: publicationsWhereInput[]
    NOT?: publicationsWhereInput | publicationsWhereInput[]
    archive?: BoolFilter<"publications"> | boolean
    num?: StringFilter<"publications"> | string
    seq_num?: BigIntFilter<"publications"> | bigint | number
    nameid?: BigIntFilter<"publications"> | bigint | number
    region?: StringNullableFilter<"publications"> | string | null
    level?: BigIntNullableFilter<"publications"> | bigint | number | null
    repeats?: BigIntFilter<"publications"> | bigint | number
    replacement?: StringNullableFilter<"publications"> | string | null
    date?: DateTimeNullableFilter<"publications"> | Date | string | null
  }, "id">

  export type publicationsOrderByWithAggregationInput = {
    id?: SortOrder
    archive?: SortOrder
    num?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    region?: SortOrderInput | SortOrder
    level?: SortOrderInput | SortOrder
    repeats?: SortOrder
    replacement?: SortOrderInput | SortOrder
    date?: SortOrderInput | SortOrder
    _count?: publicationsCountOrderByAggregateInput
    _avg?: publicationsAvgOrderByAggregateInput
    _max?: publicationsMaxOrderByAggregateInput
    _min?: publicationsMinOrderByAggregateInput
    _sum?: publicationsSumOrderByAggregateInput
  }

  export type publicationsScalarWhereWithAggregatesInput = {
    AND?: publicationsScalarWhereWithAggregatesInput | publicationsScalarWhereWithAggregatesInput[]
    OR?: publicationsScalarWhereWithAggregatesInput[]
    NOT?: publicationsScalarWhereWithAggregatesInput | publicationsScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"publications"> | bigint | number
    archive?: BoolWithAggregatesFilter<"publications"> | boolean
    num?: StringWithAggregatesFilter<"publications"> | string
    seq_num?: BigIntWithAggregatesFilter<"publications"> | bigint | number
    nameid?: BigIntWithAggregatesFilter<"publications"> | bigint | number
    region?: StringNullableWithAggregatesFilter<"publications"> | string | null
    level?: BigIntNullableWithAggregatesFilter<"publications"> | bigint | number | null
    repeats?: BigIntWithAggregatesFilter<"publications"> | bigint | number
    replacement?: StringNullableWithAggregatesFilter<"publications"> | string | null
    date?: DateTimeNullableWithAggregatesFilter<"publications"> | Date | string | null
  }

  export type shablonWhereInput = {
    AND?: shablonWhereInput | shablonWhereInput[]
    OR?: shablonWhereInput[]
    NOT?: shablonWhereInput | shablonWhereInput[]
    id?: BigIntFilter<"shablon"> | bigint | number
    w_pazl?: BigIntFilter<"shablon"> | bigint | number
    h_pazl?: BigIntFilter<"shablon"> | bigint | number
    foto?: IntFilter<"shablon"> | number
    oprd_foto?: IntFilter<"shablon"> | number
    big_cell?: BigIntFilter<"shablon"> | bigint | number
    hide_cell?: IntFilter<"shablon"> | number
    md?: StringFilter<"shablon"> | string
    type_pazl?: StringFilter<"shablon"> | string
    char_mask?: StringNullableFilter<"shablon"> | string | null
    use_year?: IntFilter<"shablon"> | number
    use_mon?: IntFilter<"shablon"> | number
    add_data?: DateTimeNullableFilter<"shablon"> | Date | string | null
  }

  export type shablonOrderByWithRelationInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    md?: SortOrder
    type_pazl?: SortOrder
    char_mask?: SortOrderInput | SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
    add_data?: SortOrderInput | SortOrder
  }

  export type shablonWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: shablonWhereInput | shablonWhereInput[]
    OR?: shablonWhereInput[]
    NOT?: shablonWhereInput | shablonWhereInput[]
    w_pazl?: BigIntFilter<"shablon"> | bigint | number
    h_pazl?: BigIntFilter<"shablon"> | bigint | number
    foto?: IntFilter<"shablon"> | number
    oprd_foto?: IntFilter<"shablon"> | number
    big_cell?: BigIntFilter<"shablon"> | bigint | number
    hide_cell?: IntFilter<"shablon"> | number
    md?: StringFilter<"shablon"> | string
    type_pazl?: StringFilter<"shablon"> | string
    char_mask?: StringNullableFilter<"shablon"> | string | null
    use_year?: IntFilter<"shablon"> | number
    use_mon?: IntFilter<"shablon"> | number
    add_data?: DateTimeNullableFilter<"shablon"> | Date | string | null
  }, "id">

  export type shablonOrderByWithAggregationInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    md?: SortOrder
    type_pazl?: SortOrder
    char_mask?: SortOrderInput | SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
    add_data?: SortOrderInput | SortOrder
    _count?: shablonCountOrderByAggregateInput
    _avg?: shablonAvgOrderByAggregateInput
    _max?: shablonMaxOrderByAggregateInput
    _min?: shablonMinOrderByAggregateInput
    _sum?: shablonSumOrderByAggregateInput
  }

  export type shablonScalarWhereWithAggregatesInput = {
    AND?: shablonScalarWhereWithAggregatesInput | shablonScalarWhereWithAggregatesInput[]
    OR?: shablonScalarWhereWithAggregatesInput[]
    NOT?: shablonScalarWhereWithAggregatesInput | shablonScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"shablon"> | bigint | number
    w_pazl?: BigIntWithAggregatesFilter<"shablon"> | bigint | number
    h_pazl?: BigIntWithAggregatesFilter<"shablon"> | bigint | number
    foto?: IntWithAggregatesFilter<"shablon"> | number
    oprd_foto?: IntWithAggregatesFilter<"shablon"> | number
    big_cell?: BigIntWithAggregatesFilter<"shablon"> | bigint | number
    hide_cell?: IntWithAggregatesFilter<"shablon"> | number
    md?: StringWithAggregatesFilter<"shablon"> | string
    type_pazl?: StringWithAggregatesFilter<"shablon"> | string
    char_mask?: StringNullableWithAggregatesFilter<"shablon"> | string | null
    use_year?: IntWithAggregatesFilter<"shablon"> | number
    use_mon?: IntWithAggregatesFilter<"shablon"> | number
    add_data?: DateTimeNullableWithAggregatesFilter<"shablon"> | Date | string | null
  }

  export type shtatWhereInput = {
    AND?: shtatWhereInput | shtatWhereInput[]
    OR?: shtatWhereInput[]
    NOT?: shtatWhereInput | shtatWhereInput[]
    id?: BigIntFilter<"shtat"> | bigint | number
    user_id?: BigIntFilter<"shtat"> | bigint | number
    shtat?: IntFilter<"shtat"> | number
    market?: BigIntFilter<"shtat"> | bigint | number
    scan_bild?: StringFilter<"shtat"> | string
    red_izd?: StringFilter<"shtat"> | string
    design?: BigIntFilter<"shtat"> | bigint | number
    lit_baz?: IntFilter<"shtat"> | number
    admin?: BoolFilter<"shtat"> | boolean
  }

  export type shtatOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    scan_bild?: SortOrder
    red_izd?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
    admin?: SortOrder
  }

  export type shtatWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: shtatWhereInput | shtatWhereInput[]
    OR?: shtatWhereInput[]
    NOT?: shtatWhereInput | shtatWhereInput[]
    user_id?: BigIntFilter<"shtat"> | bigint | number
    shtat?: IntFilter<"shtat"> | number
    market?: BigIntFilter<"shtat"> | bigint | number
    scan_bild?: StringFilter<"shtat"> | string
    red_izd?: StringFilter<"shtat"> | string
    design?: BigIntFilter<"shtat"> | bigint | number
    lit_baz?: IntFilter<"shtat"> | number
    admin?: BoolFilter<"shtat"> | boolean
  }, "id">

  export type shtatOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    scan_bild?: SortOrder
    red_izd?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
    admin?: SortOrder
    _count?: shtatCountOrderByAggregateInput
    _avg?: shtatAvgOrderByAggregateInput
    _max?: shtatMaxOrderByAggregateInput
    _min?: shtatMinOrderByAggregateInput
    _sum?: shtatSumOrderByAggregateInput
  }

  export type shtatScalarWhereWithAggregatesInput = {
    AND?: shtatScalarWhereWithAggregatesInput | shtatScalarWhereWithAggregatesInput[]
    OR?: shtatScalarWhereWithAggregatesInput[]
    NOT?: shtatScalarWhereWithAggregatesInput | shtatScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"shtat"> | bigint | number
    user_id?: BigIntWithAggregatesFilter<"shtat"> | bigint | number
    shtat?: IntWithAggregatesFilter<"shtat"> | number
    market?: BigIntWithAggregatesFilter<"shtat"> | bigint | number
    scan_bild?: StringWithAggregatesFilter<"shtat"> | string
    red_izd?: StringWithAggregatesFilter<"shtat"> | string
    design?: BigIntWithAggregatesFilter<"shtat"> | bigint | number
    lit_baz?: IntWithAggregatesFilter<"shtat"> | number
    admin?: BoolWithAggregatesFilter<"shtat"> | boolean
  }

  export type temsWhereInput = {
    AND?: temsWhereInput | temsWhereInput[]
    OR?: temsWhereInput[]
    NOT?: temsWhereInput | temsWhereInput[]
    id?: BigIntFilter<"tems"> | bigint | number
    cod?: BigIntFilter<"tems"> | bigint | number
    name?: StringFilter<"tems"> | string
  }

  export type temsOrderByWithRelationInput = {
    id?: SortOrder
    cod?: SortOrder
    name?: SortOrder
  }

  export type temsWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: temsWhereInput | temsWhereInput[]
    OR?: temsWhereInput[]
    NOT?: temsWhereInput | temsWhereInput[]
    cod?: BigIntFilter<"tems"> | bigint | number
    name?: StringFilter<"tems"> | string
  }, "id">

  export type temsOrderByWithAggregationInput = {
    id?: SortOrder
    cod?: SortOrder
    name?: SortOrder
    _count?: temsCountOrderByAggregateInput
    _avg?: temsAvgOrderByAggregateInput
    _max?: temsMaxOrderByAggregateInput
    _min?: temsMinOrderByAggregateInput
    _sum?: temsSumOrderByAggregateInput
  }

  export type temsScalarWhereWithAggregatesInput = {
    AND?: temsScalarWhereWithAggregatesInput | temsScalarWhereWithAggregatesInput[]
    OR?: temsScalarWhereWithAggregatesInput[]
    NOT?: temsScalarWhereWithAggregatesInput | temsScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"tems"> | bigint | number
    cod?: BigIntWithAggregatesFilter<"tems"> | bigint | number
    name?: StringWithAggregatesFilter<"tems"> | string
  }

  export type userWhereInput = {
    AND?: userWhereInput | userWhereInput[]
    OR?: userWhereInput[]
    NOT?: userWhereInput | userWhereInput[]
    id?: BigIntFilter<"user"> | bigint | number
    name?: StringFilter<"user"> | string
    password?: StringFilter<"user"> | string
    menu?: StringFilter<"user"> | string
    fio?: StringFilter<"user"> | string
    pamd?: StringFilter<"user"> | string
    end_free?: DateTimeNullableFilter<"user"> | Date | string | null
  }

  export type userOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    password?: SortOrder
    menu?: SortOrder
    fio?: SortOrder
    pamd?: SortOrder
    end_free?: SortOrderInput | SortOrder
  }

  export type userWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: userWhereInput | userWhereInput[]
    OR?: userWhereInput[]
    NOT?: userWhereInput | userWhereInput[]
    name?: StringFilter<"user"> | string
    password?: StringFilter<"user"> | string
    menu?: StringFilter<"user"> | string
    fio?: StringFilter<"user"> | string
    pamd?: StringFilter<"user"> | string
    end_free?: DateTimeNullableFilter<"user"> | Date | string | null
  }, "id">

  export type userOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    password?: SortOrder
    menu?: SortOrder
    fio?: SortOrder
    pamd?: SortOrder
    end_free?: SortOrderInput | SortOrder
    _count?: userCountOrderByAggregateInput
    _avg?: userAvgOrderByAggregateInput
    _max?: userMaxOrderByAggregateInput
    _min?: userMinOrderByAggregateInput
    _sum?: userSumOrderByAggregateInput
  }

  export type userScalarWhereWithAggregatesInput = {
    AND?: userScalarWhereWithAggregatesInput | userScalarWhereWithAggregatesInput[]
    OR?: userScalarWhereWithAggregatesInput[]
    NOT?: userScalarWhereWithAggregatesInput | userScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"user"> | bigint | number
    name?: StringWithAggregatesFilter<"user"> | string
    password?: StringWithAggregatesFilter<"user"> | string
    menu?: StringWithAggregatesFilter<"user"> | string
    fio?: StringWithAggregatesFilter<"user"> | string
    pamd?: StringWithAggregatesFilter<"user"> | string
    end_free?: DateTimeNullableWithAggregatesFilter<"user"> | Date | string | null
  }

  export type word_groupWhereInput = {
    AND?: word_groupWhereInput | word_groupWhereInput[]
    OR?: word_groupWhereInput[]
    NOT?: word_groupWhereInput | word_groupWhereInput[]
    id?: BigIntFilter<"word_group"> | bigint | number
    text_word?: StringFilter<"word_group"> | string
  }

  export type word_groupOrderByWithRelationInput = {
    id?: SortOrder
    text_word?: SortOrder
  }

  export type word_groupWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: word_groupWhereInput | word_groupWhereInput[]
    OR?: word_groupWhereInput[]
    NOT?: word_groupWhereInput | word_groupWhereInput[]
    text_word?: StringFilter<"word_group"> | string
  }, "id">

  export type word_groupOrderByWithAggregationInput = {
    id?: SortOrder
    text_word?: SortOrder
    _count?: word_groupCountOrderByAggregateInput
    _avg?: word_groupAvgOrderByAggregateInput
    _max?: word_groupMaxOrderByAggregateInput
    _min?: word_groupMinOrderByAggregateInput
    _sum?: word_groupSumOrderByAggregateInput
  }

  export type word_groupScalarWhereWithAggregatesInput = {
    AND?: word_groupScalarWhereWithAggregatesInput | word_groupScalarWhereWithAggregatesInput[]
    OR?: word_groupScalarWhereWithAggregatesInput[]
    NOT?: word_groupScalarWhereWithAggregatesInput | word_groupScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"word_group"> | bigint | number
    text_word?: StringWithAggregatesFilter<"word_group"> | string
  }

  export type words_vWhereInput = {
    AND?: words_vWhereInput | words_vWhereInput[]
    OR?: words_vWhereInput[]
    NOT?: words_vWhereInput | words_vWhereInput[]
    id?: BigIntFilter<"words_v"> | bigint | number
    word_text?: StringFilter<"words_v"> | string
    lingv?: StringFilter<"words_v"> | string
    key_word?: IntFilter<"words_v"> | number
    skan?: IntFilter<"words_v"> | number
    word_group?: BigIntFilter<"words_v"> | bigint | number
    foto?: StringFilter<"words_v"> | string
    back_id?: BigIntFilter<"words_v"> | bigint | number
    word_length?: IntFilter<"words_v"> | number
  }

  export type words_vOrderByWithRelationInput = {
    id?: SortOrder
    word_text?: SortOrder
    lingv?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    foto?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type words_vWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: words_vWhereInput | words_vWhereInput[]
    OR?: words_vWhereInput[]
    NOT?: words_vWhereInput | words_vWhereInput[]
    word_text?: StringFilter<"words_v"> | string
    lingv?: StringFilter<"words_v"> | string
    key_word?: IntFilter<"words_v"> | number
    skan?: IntFilter<"words_v"> | number
    word_group?: BigIntFilter<"words_v"> | bigint | number
    foto?: StringFilter<"words_v"> | string
    back_id?: BigIntFilter<"words_v"> | bigint | number
    word_length?: IntFilter<"words_v"> | number
  }, "id">

  export type words_vOrderByWithAggregationInput = {
    id?: SortOrder
    word_text?: SortOrder
    lingv?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    foto?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
    _count?: words_vCountOrderByAggregateInput
    _avg?: words_vAvgOrderByAggregateInput
    _max?: words_vMaxOrderByAggregateInput
    _min?: words_vMinOrderByAggregateInput
    _sum?: words_vSumOrderByAggregateInput
  }

  export type words_vScalarWhereWithAggregatesInput = {
    AND?: words_vScalarWhereWithAggregatesInput | words_vScalarWhereWithAggregatesInput[]
    OR?: words_vScalarWhereWithAggregatesInput[]
    NOT?: words_vScalarWhereWithAggregatesInput | words_vScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"words_v"> | bigint | number
    word_text?: StringWithAggregatesFilter<"words_v"> | string
    lingv?: StringWithAggregatesFilter<"words_v"> | string
    key_word?: IntWithAggregatesFilter<"words_v"> | number
    skan?: IntWithAggregatesFilter<"words_v"> | number
    word_group?: BigIntWithAggregatesFilter<"words_v"> | bigint | number
    foto?: StringWithAggregatesFilter<"words_v"> | string
    back_id?: BigIntWithAggregatesFilter<"words_v"> | bigint | number
    word_length?: IntWithAggregatesFilter<"words_v"> | number
  }

  export type izd_nameCreateInput = {
    id?: bigint | number
    name: string
    redakcia?: string
    tabl_name: string
    add_user: string
    add_data?: Date | string | null
  }

  export type izd_nameUncheckedCreateInput = {
    id?: bigint | number
    name: string
    redakcia?: string
    tabl_name: string
    add_user: string
    add_data?: Date | string | null
  }

  export type izd_nameUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    redakcia?: StringFieldUpdateOperationsInput | string
    tabl_name?: StringFieldUpdateOperationsInput | string
    add_user?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type izd_nameUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    redakcia?: StringFieldUpdateOperationsInput | string
    tabl_name?: StringFieldUpdateOperationsInput | string
    add_user?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type izd_nameCreateManyInput = {
    id?: bigint | number
    name: string
    redakcia?: string
    tabl_name: string
    add_user: string
    add_data?: Date | string | null
  }

  export type izd_nameUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    redakcia?: StringFieldUpdateOperationsInput | string
    tabl_name?: StringFieldUpdateOperationsInput | string
    add_user?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type izd_nameUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    redakcia?: StringFieldUpdateOperationsInput | string
    tabl_name?: StringFieldUpdateOperationsInput | string
    add_user?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type number_izdCreateInput = {
    id?: bigint | number
    izd_id: bigint | number
    curent_id: bigint | number
    pub_numb?: string
  }

  export type number_izdUncheckedCreateInput = {
    id?: bigint | number
    izd_id: bigint | number
    curent_id: bigint | number
    pub_numb?: string
  }

  export type number_izdUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    izd_id?: BigIntFieldUpdateOperationsInput | bigint | number
    curent_id?: BigIntFieldUpdateOperationsInput | bigint | number
    pub_numb?: StringFieldUpdateOperationsInput | string
  }

  export type number_izdUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    izd_id?: BigIntFieldUpdateOperationsInput | bigint | number
    curent_id?: BigIntFieldUpdateOperationsInput | bigint | number
    pub_numb?: StringFieldUpdateOperationsInput | string
  }

  export type number_izdCreateManyInput = {
    id?: bigint | number
    izd_id: bigint | number
    curent_id: bigint | number
    pub_numb?: string
  }

  export type number_izdUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    izd_id?: BigIntFieldUpdateOperationsInput | bigint | number
    curent_id?: BigIntFieldUpdateOperationsInput | bigint | number
    pub_numb?: StringFieldUpdateOperationsInput | string
  }

  export type number_izdUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    izd_id?: BigIntFieldUpdateOperationsInput | bigint | number
    curent_id?: BigIntFieldUpdateOperationsInput | bigint | number
    pub_numb?: StringFieldUpdateOperationsInput | string
  }

  export type opred_vCreateInput = {
    id?: bigint | number
    word_id?: bigint | number
    text_opr?: string
    end_date?: Date | string | null
    lang?: string
    tema?: bigint | number
    livel?: number
    w1?: number
    w2?: number
    w3?: number
    id_file?: bigint | number
    use_for_bild?: number
    user_add?: string
    add_data?: Date | string | null
    edit_user?: string
    edit_data?: Date | string | null
    coment?: string
    set_reg?: bigint | number
    user_set?: string
    back_id?: bigint | number
  }

  export type opred_vUncheckedCreateInput = {
    id?: bigint | number
    word_id?: bigint | number
    text_opr?: string
    end_date?: Date | string | null
    lang?: string
    tema?: bigint | number
    livel?: number
    w1?: number
    w2?: number
    w3?: number
    id_file?: bigint | number
    use_for_bild?: number
    user_add?: string
    add_data?: Date | string | null
    edit_user?: string
    edit_data?: Date | string | null
    coment?: string
    set_reg?: bigint | number
    user_set?: string
    back_id?: bigint | number
  }

  export type opred_vUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_opr?: StringFieldUpdateOperationsInput | string
    end_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lang?: StringFieldUpdateOperationsInput | string
    tema?: BigIntFieldUpdateOperationsInput | bigint | number
    livel?: IntFieldUpdateOperationsInput | number
    w1?: IntFieldUpdateOperationsInput | number
    w2?: IntFieldUpdateOperationsInput | number
    w3?: IntFieldUpdateOperationsInput | number
    id_file?: BigIntFieldUpdateOperationsInput | bigint | number
    use_for_bild?: IntFieldUpdateOperationsInput | number
    user_add?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    edit_user?: StringFieldUpdateOperationsInput | string
    edit_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    coment?: StringFieldUpdateOperationsInput | string
    set_reg?: BigIntFieldUpdateOperationsInput | bigint | number
    user_set?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
  }

  export type opred_vUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_opr?: StringFieldUpdateOperationsInput | string
    end_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lang?: StringFieldUpdateOperationsInput | string
    tema?: BigIntFieldUpdateOperationsInput | bigint | number
    livel?: IntFieldUpdateOperationsInput | number
    w1?: IntFieldUpdateOperationsInput | number
    w2?: IntFieldUpdateOperationsInput | number
    w3?: IntFieldUpdateOperationsInput | number
    id_file?: BigIntFieldUpdateOperationsInput | bigint | number
    use_for_bild?: IntFieldUpdateOperationsInput | number
    user_add?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    edit_user?: StringFieldUpdateOperationsInput | string
    edit_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    coment?: StringFieldUpdateOperationsInput | string
    set_reg?: BigIntFieldUpdateOperationsInput | bigint | number
    user_set?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
  }

  export type opred_vCreateManyInput = {
    id?: bigint | number
    word_id?: bigint | number
    text_opr?: string
    end_date?: Date | string | null
    lang?: string
    tema?: bigint | number
    livel?: number
    w1?: number
    w2?: number
    w3?: number
    id_file?: bigint | number
    use_for_bild?: number
    user_add?: string
    add_data?: Date | string | null
    edit_user?: string
    edit_data?: Date | string | null
    coment?: string
    set_reg?: bigint | number
    user_set?: string
    back_id?: bigint | number
  }

  export type opred_vUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_opr?: StringFieldUpdateOperationsInput | string
    end_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lang?: StringFieldUpdateOperationsInput | string
    tema?: BigIntFieldUpdateOperationsInput | bigint | number
    livel?: IntFieldUpdateOperationsInput | number
    w1?: IntFieldUpdateOperationsInput | number
    w2?: IntFieldUpdateOperationsInput | number
    w3?: IntFieldUpdateOperationsInput | number
    id_file?: BigIntFieldUpdateOperationsInput | bigint | number
    use_for_bild?: IntFieldUpdateOperationsInput | number
    user_add?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    edit_user?: StringFieldUpdateOperationsInput | string
    edit_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    coment?: StringFieldUpdateOperationsInput | string
    set_reg?: BigIntFieldUpdateOperationsInput | bigint | number
    user_set?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
  }

  export type opred_vUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_opr?: StringFieldUpdateOperationsInput | string
    end_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lang?: StringFieldUpdateOperationsInput | string
    tema?: BigIntFieldUpdateOperationsInput | bigint | number
    livel?: IntFieldUpdateOperationsInput | number
    w1?: IntFieldUpdateOperationsInput | number
    w2?: IntFieldUpdateOperationsInput | number
    w3?: IntFieldUpdateOperationsInput | number
    id_file?: BigIntFieldUpdateOperationsInput | bigint | number
    use_for_bild?: IntFieldUpdateOperationsInput | number
    user_add?: StringFieldUpdateOperationsInput | string
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    edit_user?: StringFieldUpdateOperationsInput | string
    edit_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    coment?: StringFieldUpdateOperationsInput | string
    set_reg?: BigIntFieldUpdateOperationsInput | bigint | number
    user_set?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
  }

  export type publicationsCreateInput = {
    id?: bigint | number
    archive: boolean
    num: string
    seq_num: bigint | number
    nameid: bigint | number
    region?: string | null
    level?: bigint | number | null
    repeats?: bigint | number
    replacement?: string | null
    date?: Date | string | null
  }

  export type publicationsUncheckedCreateInput = {
    id?: bigint | number
    archive: boolean
    num: string
    seq_num: bigint | number
    nameid: bigint | number
    region?: string | null
    level?: bigint | number | null
    repeats?: bigint | number
    replacement?: string | null
    date?: Date | string | null
  }

  export type publicationsUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    archive?: BoolFieldUpdateOperationsInput | boolean
    num?: StringFieldUpdateOperationsInput | string
    seq_num?: BigIntFieldUpdateOperationsInput | bigint | number
    nameid?: BigIntFieldUpdateOperationsInput | bigint | number
    region?: NullableStringFieldUpdateOperationsInput | string | null
    level?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    repeats?: BigIntFieldUpdateOperationsInput | bigint | number
    replacement?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type publicationsUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    archive?: BoolFieldUpdateOperationsInput | boolean
    num?: StringFieldUpdateOperationsInput | string
    seq_num?: BigIntFieldUpdateOperationsInput | bigint | number
    nameid?: BigIntFieldUpdateOperationsInput | bigint | number
    region?: NullableStringFieldUpdateOperationsInput | string | null
    level?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    repeats?: BigIntFieldUpdateOperationsInput | bigint | number
    replacement?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type publicationsCreateManyInput = {
    id?: bigint | number
    archive: boolean
    num: string
    seq_num: bigint | number
    nameid: bigint | number
    region?: string | null
    level?: bigint | number | null
    repeats?: bigint | number
    replacement?: string | null
    date?: Date | string | null
  }

  export type publicationsUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    archive?: BoolFieldUpdateOperationsInput | boolean
    num?: StringFieldUpdateOperationsInput | string
    seq_num?: BigIntFieldUpdateOperationsInput | bigint | number
    nameid?: BigIntFieldUpdateOperationsInput | bigint | number
    region?: NullableStringFieldUpdateOperationsInput | string | null
    level?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    repeats?: BigIntFieldUpdateOperationsInput | bigint | number
    replacement?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type publicationsUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    archive?: BoolFieldUpdateOperationsInput | boolean
    num?: StringFieldUpdateOperationsInput | string
    seq_num?: BigIntFieldUpdateOperationsInput | bigint | number
    nameid?: BigIntFieldUpdateOperationsInput | bigint | number
    region?: NullableStringFieldUpdateOperationsInput | string | null
    level?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    repeats?: BigIntFieldUpdateOperationsInput | bigint | number
    replacement?: NullableStringFieldUpdateOperationsInput | string | null
    date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type shablonCreateInput = {
    id?: bigint | number
    w_pazl: bigint | number
    h_pazl: bigint | number
    foto: number
    oprd_foto: number
    big_cell: bigint | number
    hide_cell: number
    md: string
    type_pazl: string
    char_mask?: string | null
    use_year?: number
    use_mon?: number
    add_data?: Date | string | null
  }

  export type shablonUncheckedCreateInput = {
    id?: bigint | number
    w_pazl: bigint | number
    h_pazl: bigint | number
    foto: number
    oprd_foto: number
    big_cell: bigint | number
    hide_cell: number
    md: string
    type_pazl: string
    char_mask?: string | null
    use_year?: number
    use_mon?: number
    add_data?: Date | string | null
  }

  export type shablonUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    w_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    h_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: IntFieldUpdateOperationsInput | number
    oprd_foto?: IntFieldUpdateOperationsInput | number
    big_cell?: BigIntFieldUpdateOperationsInput | bigint | number
    hide_cell?: IntFieldUpdateOperationsInput | number
    md?: StringFieldUpdateOperationsInput | string
    type_pazl?: StringFieldUpdateOperationsInput | string
    char_mask?: NullableStringFieldUpdateOperationsInput | string | null
    use_year?: IntFieldUpdateOperationsInput | number
    use_mon?: IntFieldUpdateOperationsInput | number
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type shablonUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    w_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    h_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: IntFieldUpdateOperationsInput | number
    oprd_foto?: IntFieldUpdateOperationsInput | number
    big_cell?: BigIntFieldUpdateOperationsInput | bigint | number
    hide_cell?: IntFieldUpdateOperationsInput | number
    md?: StringFieldUpdateOperationsInput | string
    type_pazl?: StringFieldUpdateOperationsInput | string
    char_mask?: NullableStringFieldUpdateOperationsInput | string | null
    use_year?: IntFieldUpdateOperationsInput | number
    use_mon?: IntFieldUpdateOperationsInput | number
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type shablonCreateManyInput = {
    id?: bigint | number
    w_pazl: bigint | number
    h_pazl: bigint | number
    foto: number
    oprd_foto: number
    big_cell: bigint | number
    hide_cell: number
    md: string
    type_pazl: string
    char_mask?: string | null
    use_year?: number
    use_mon?: number
    add_data?: Date | string | null
  }

  export type shablonUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    w_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    h_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: IntFieldUpdateOperationsInput | number
    oprd_foto?: IntFieldUpdateOperationsInput | number
    big_cell?: BigIntFieldUpdateOperationsInput | bigint | number
    hide_cell?: IntFieldUpdateOperationsInput | number
    md?: StringFieldUpdateOperationsInput | string
    type_pazl?: StringFieldUpdateOperationsInput | string
    char_mask?: NullableStringFieldUpdateOperationsInput | string | null
    use_year?: IntFieldUpdateOperationsInput | number
    use_mon?: IntFieldUpdateOperationsInput | number
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type shablonUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    w_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    h_pazl?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: IntFieldUpdateOperationsInput | number
    oprd_foto?: IntFieldUpdateOperationsInput | number
    big_cell?: BigIntFieldUpdateOperationsInput | bigint | number
    hide_cell?: IntFieldUpdateOperationsInput | number
    md?: StringFieldUpdateOperationsInput | string
    type_pazl?: StringFieldUpdateOperationsInput | string
    char_mask?: NullableStringFieldUpdateOperationsInput | string | null
    use_year?: IntFieldUpdateOperationsInput | number
    use_mon?: IntFieldUpdateOperationsInput | number
    add_data?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type shtatCreateInput = {
    id?: bigint | number
    user_id: bigint | number
    shtat?: number
    market?: bigint | number
    scan_bild: string
    red_izd: string
    design?: bigint | number
    lit_baz?: number
    admin: boolean
  }

  export type shtatUncheckedCreateInput = {
    id?: bigint | number
    user_id: bigint | number
    shtat?: number
    market?: bigint | number
    scan_bild: string
    red_izd: string
    design?: bigint | number
    lit_baz?: number
    admin: boolean
  }

  export type shtatUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    shtat?: IntFieldUpdateOperationsInput | number
    market?: BigIntFieldUpdateOperationsInput | bigint | number
    scan_bild?: StringFieldUpdateOperationsInput | string
    red_izd?: StringFieldUpdateOperationsInput | string
    design?: BigIntFieldUpdateOperationsInput | bigint | number
    lit_baz?: IntFieldUpdateOperationsInput | number
    admin?: BoolFieldUpdateOperationsInput | boolean
  }

  export type shtatUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    shtat?: IntFieldUpdateOperationsInput | number
    market?: BigIntFieldUpdateOperationsInput | bigint | number
    scan_bild?: StringFieldUpdateOperationsInput | string
    red_izd?: StringFieldUpdateOperationsInput | string
    design?: BigIntFieldUpdateOperationsInput | bigint | number
    lit_baz?: IntFieldUpdateOperationsInput | number
    admin?: BoolFieldUpdateOperationsInput | boolean
  }

  export type shtatCreateManyInput = {
    id?: bigint | number
    user_id: bigint | number
    shtat?: number
    market?: bigint | number
    scan_bild: string
    red_izd: string
    design?: bigint | number
    lit_baz?: number
    admin: boolean
  }

  export type shtatUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    shtat?: IntFieldUpdateOperationsInput | number
    market?: BigIntFieldUpdateOperationsInput | bigint | number
    scan_bild?: StringFieldUpdateOperationsInput | string
    red_izd?: StringFieldUpdateOperationsInput | string
    design?: BigIntFieldUpdateOperationsInput | bigint | number
    lit_baz?: IntFieldUpdateOperationsInput | number
    admin?: BoolFieldUpdateOperationsInput | boolean
  }

  export type shtatUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    shtat?: IntFieldUpdateOperationsInput | number
    market?: BigIntFieldUpdateOperationsInput | bigint | number
    scan_bild?: StringFieldUpdateOperationsInput | string
    red_izd?: StringFieldUpdateOperationsInput | string
    design?: BigIntFieldUpdateOperationsInput | bigint | number
    lit_baz?: IntFieldUpdateOperationsInput | number
    admin?: BoolFieldUpdateOperationsInput | boolean
  }

  export type temsCreateInput = {
    id?: bigint | number
    cod: bigint | number
    name: string
  }

  export type temsUncheckedCreateInput = {
    id?: bigint | number
    cod: bigint | number
    name: string
  }

  export type temsUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    cod?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
  }

  export type temsUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    cod?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
  }

  export type temsCreateManyInput = {
    id?: bigint | number
    cod: bigint | number
    name: string
  }

  export type temsUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    cod?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
  }

  export type temsUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    cod?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
  }

  export type userCreateInput = {
    id?: bigint | number
    name: string
    password: string
    menu?: string
    fio: string
    pamd: string
    end_free?: Date | string | null
  }

  export type userUncheckedCreateInput = {
    id?: bigint | number
    name: string
    password: string
    menu?: string
    fio: string
    pamd: string
    end_free?: Date | string | null
  }

  export type userUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    menu?: StringFieldUpdateOperationsInput | string
    fio?: StringFieldUpdateOperationsInput | string
    pamd?: StringFieldUpdateOperationsInput | string
    end_free?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type userUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    menu?: StringFieldUpdateOperationsInput | string
    fio?: StringFieldUpdateOperationsInput | string
    pamd?: StringFieldUpdateOperationsInput | string
    end_free?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type userCreateManyInput = {
    id?: bigint | number
    name: string
    password: string
    menu?: string
    fio: string
    pamd: string
    end_free?: Date | string | null
  }

  export type userUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    menu?: StringFieldUpdateOperationsInput | string
    fio?: StringFieldUpdateOperationsInput | string
    pamd?: StringFieldUpdateOperationsInput | string
    end_free?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type userUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    name?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    menu?: StringFieldUpdateOperationsInput | string
    fio?: StringFieldUpdateOperationsInput | string
    pamd?: StringFieldUpdateOperationsInput | string
    end_free?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type word_groupCreateInput = {
    id?: bigint | number
    text_word: string
  }

  export type word_groupUncheckedCreateInput = {
    id?: bigint | number
    text_word: string
  }

  export type word_groupUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_word?: StringFieldUpdateOperationsInput | string
  }

  export type word_groupUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_word?: StringFieldUpdateOperationsInput | string
  }

  export type word_groupCreateManyInput = {
    id?: bigint | number
    text_word: string
  }

  export type word_groupUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_word?: StringFieldUpdateOperationsInput | string
  }

  export type word_groupUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    text_word?: StringFieldUpdateOperationsInput | string
  }

  export type words_vCreateInput = {
    id?: bigint | number
    word_text: string
    lingv?: string
    key_word?: number
    skan?: number
    word_group?: bigint | number
    foto?: string
    back_id?: bigint | number
    word_length: number
  }

  export type words_vUncheckedCreateInput = {
    id?: bigint | number
    word_text: string
    lingv?: string
    key_word?: number
    skan?: number
    word_group?: bigint | number
    foto?: string
    back_id?: bigint | number
    word_length: number
  }

  export type words_vUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_text?: StringFieldUpdateOperationsInput | string
    lingv?: StringFieldUpdateOperationsInput | string
    key_word?: IntFieldUpdateOperationsInput | number
    skan?: IntFieldUpdateOperationsInput | number
    word_group?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_length?: IntFieldUpdateOperationsInput | number
  }

  export type words_vUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_text?: StringFieldUpdateOperationsInput | string
    lingv?: StringFieldUpdateOperationsInput | string
    key_word?: IntFieldUpdateOperationsInput | number
    skan?: IntFieldUpdateOperationsInput | number
    word_group?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_length?: IntFieldUpdateOperationsInput | number
  }

  export type words_vCreateManyInput = {
    id?: bigint | number
    word_text: string
    lingv?: string
    key_word?: number
    skan?: number
    word_group?: bigint | number
    foto?: string
    back_id?: bigint | number
    word_length: number
  }

  export type words_vUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_text?: StringFieldUpdateOperationsInput | string
    lingv?: StringFieldUpdateOperationsInput | string
    key_word?: IntFieldUpdateOperationsInput | number
    skan?: IntFieldUpdateOperationsInput | number
    word_group?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_length?: IntFieldUpdateOperationsInput | number
  }

  export type words_vUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_text?: StringFieldUpdateOperationsInput | string
    lingv?: StringFieldUpdateOperationsInput | string
    key_word?: IntFieldUpdateOperationsInput | number
    skan?: IntFieldUpdateOperationsInput | number
    word_group?: BigIntFieldUpdateOperationsInput | bigint | number
    foto?: StringFieldUpdateOperationsInput | string
    back_id?: BigIntFieldUpdateOperationsInput | bigint | number
    word_length?: IntFieldUpdateOperationsInput | number
  }

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type izd_nameCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    redakcia?: SortOrder
    tabl_name?: SortOrder
    add_user?: SortOrder
    add_data?: SortOrder
  }

  export type izd_nameAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type izd_nameMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    redakcia?: SortOrder
    tabl_name?: SortOrder
    add_user?: SortOrder
    add_data?: SortOrder
  }

  export type izd_nameMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    redakcia?: SortOrder
    tabl_name?: SortOrder
    add_user?: SortOrder
    add_data?: SortOrder
  }

  export type izd_nameSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type number_izdCountOrderByAggregateInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
    pub_numb?: SortOrder
  }

  export type number_izdAvgOrderByAggregateInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
  }

  export type number_izdMaxOrderByAggregateInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
    pub_numb?: SortOrder
  }

  export type number_izdMinOrderByAggregateInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
    pub_numb?: SortOrder
  }

  export type number_izdSumOrderByAggregateInput = {
    id?: SortOrder
    izd_id?: SortOrder
    curent_id?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type opred_vCountOrderByAggregateInput = {
    id?: SortOrder
    word_id?: SortOrder
    text_opr?: SortOrder
    end_date?: SortOrder
    lang?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    user_add?: SortOrder
    add_data?: SortOrder
    edit_user?: SortOrder
    edit_data?: SortOrder
    coment?: SortOrder
    set_reg?: SortOrder
    user_set?: SortOrder
    back_id?: SortOrder
  }

  export type opred_vAvgOrderByAggregateInput = {
    id?: SortOrder
    word_id?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    set_reg?: SortOrder
    back_id?: SortOrder
  }

  export type opred_vMaxOrderByAggregateInput = {
    id?: SortOrder
    word_id?: SortOrder
    text_opr?: SortOrder
    end_date?: SortOrder
    lang?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    user_add?: SortOrder
    add_data?: SortOrder
    edit_user?: SortOrder
    edit_data?: SortOrder
    coment?: SortOrder
    set_reg?: SortOrder
    user_set?: SortOrder
    back_id?: SortOrder
  }

  export type opred_vMinOrderByAggregateInput = {
    id?: SortOrder
    word_id?: SortOrder
    text_opr?: SortOrder
    end_date?: SortOrder
    lang?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    user_add?: SortOrder
    add_data?: SortOrder
    edit_user?: SortOrder
    edit_data?: SortOrder
    coment?: SortOrder
    set_reg?: SortOrder
    user_set?: SortOrder
    back_id?: SortOrder
  }

  export type opred_vSumOrderByAggregateInput = {
    id?: SortOrder
    word_id?: SortOrder
    tema?: SortOrder
    livel?: SortOrder
    w1?: SortOrder
    w2?: SortOrder
    w3?: SortOrder
    id_file?: SortOrder
    use_for_bild?: SortOrder
    set_reg?: SortOrder
    back_id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }

  export type publicationsCountOrderByAggregateInput = {
    id?: SortOrder
    archive?: SortOrder
    num?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    region?: SortOrder
    level?: SortOrder
    repeats?: SortOrder
    replacement?: SortOrder
    date?: SortOrder
  }

  export type publicationsAvgOrderByAggregateInput = {
    id?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    level?: SortOrder
    repeats?: SortOrder
  }

  export type publicationsMaxOrderByAggregateInput = {
    id?: SortOrder
    archive?: SortOrder
    num?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    region?: SortOrder
    level?: SortOrder
    repeats?: SortOrder
    replacement?: SortOrder
    date?: SortOrder
  }

  export type publicationsMinOrderByAggregateInput = {
    id?: SortOrder
    archive?: SortOrder
    num?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    region?: SortOrder
    level?: SortOrder
    repeats?: SortOrder
    replacement?: SortOrder
    date?: SortOrder
  }

  export type publicationsSumOrderByAggregateInput = {
    id?: SortOrder
    seq_num?: SortOrder
    nameid?: SortOrder
    level?: SortOrder
    repeats?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }

  export type shablonCountOrderByAggregateInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    md?: SortOrder
    type_pazl?: SortOrder
    char_mask?: SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
    add_data?: SortOrder
  }

  export type shablonAvgOrderByAggregateInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
  }

  export type shablonMaxOrderByAggregateInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    md?: SortOrder
    type_pazl?: SortOrder
    char_mask?: SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
    add_data?: SortOrder
  }

  export type shablonMinOrderByAggregateInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    md?: SortOrder
    type_pazl?: SortOrder
    char_mask?: SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
    add_data?: SortOrder
  }

  export type shablonSumOrderByAggregateInput = {
    id?: SortOrder
    w_pazl?: SortOrder
    h_pazl?: SortOrder
    foto?: SortOrder
    oprd_foto?: SortOrder
    big_cell?: SortOrder
    hide_cell?: SortOrder
    use_year?: SortOrder
    use_mon?: SortOrder
  }

  export type shtatCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    scan_bild?: SortOrder
    red_izd?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
    admin?: SortOrder
  }

  export type shtatAvgOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
  }

  export type shtatMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    scan_bild?: SortOrder
    red_izd?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
    admin?: SortOrder
  }

  export type shtatMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    scan_bild?: SortOrder
    red_izd?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
    admin?: SortOrder
  }

  export type shtatSumOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    shtat?: SortOrder
    market?: SortOrder
    design?: SortOrder
    lit_baz?: SortOrder
  }

  export type temsCountOrderByAggregateInput = {
    id?: SortOrder
    cod?: SortOrder
    name?: SortOrder
  }

  export type temsAvgOrderByAggregateInput = {
    id?: SortOrder
    cod?: SortOrder
  }

  export type temsMaxOrderByAggregateInput = {
    id?: SortOrder
    cod?: SortOrder
    name?: SortOrder
  }

  export type temsMinOrderByAggregateInput = {
    id?: SortOrder
    cod?: SortOrder
    name?: SortOrder
  }

  export type temsSumOrderByAggregateInput = {
    id?: SortOrder
    cod?: SortOrder
  }

  export type userCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    password?: SortOrder
    menu?: SortOrder
    fio?: SortOrder
    pamd?: SortOrder
    end_free?: SortOrder
  }

  export type userAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type userMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    password?: SortOrder
    menu?: SortOrder
    fio?: SortOrder
    pamd?: SortOrder
    end_free?: SortOrder
  }

  export type userMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    password?: SortOrder
    menu?: SortOrder
    fio?: SortOrder
    pamd?: SortOrder
    end_free?: SortOrder
  }

  export type userSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type word_groupCountOrderByAggregateInput = {
    id?: SortOrder
    text_word?: SortOrder
  }

  export type word_groupAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type word_groupMaxOrderByAggregateInput = {
    id?: SortOrder
    text_word?: SortOrder
  }

  export type word_groupMinOrderByAggregateInput = {
    id?: SortOrder
    text_word?: SortOrder
  }

  export type word_groupSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type words_vCountOrderByAggregateInput = {
    id?: SortOrder
    word_text?: SortOrder
    lingv?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    foto?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type words_vAvgOrderByAggregateInput = {
    id?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type words_vMaxOrderByAggregateInput = {
    id?: SortOrder
    word_text?: SortOrder
    lingv?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    foto?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type words_vMinOrderByAggregateInput = {
    id?: SortOrder
    word_text?: SortOrder
    lingv?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    foto?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type words_vSumOrderByAggregateInput = {
    id?: SortOrder
    key_word?: SortOrder
    skan?: SortOrder
    word_group?: SortOrder
    back_id?: SortOrder
    word_length?: SortOrder
  }

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableBigIntFieldUpdateOperationsInput = {
    set?: bigint | number | null
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedBigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}