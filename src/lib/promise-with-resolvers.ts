type PromiseWithResolversResult<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PromiseWithResolversConstructor = PromiseConstructor & {
  withResolvers?<T>(): PromiseWithResolversResult<T>;
};

const PromiseConstructorWithResolvers =
  Promise as PromiseWithResolversConstructor;

if (typeof PromiseConstructorWithResolvers.withResolvers !== 'function') {
  PromiseConstructorWithResolvers.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };
}
