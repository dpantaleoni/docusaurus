/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {createMDXLoaderItem} from '../createMDXLoader';

jest.mock('../processor', () => ({
  createProcessors: jest.fn().mockResolvedValue({
    mdxProcessor: {},
    rehypeProcessor: {},
  }),
}));

// describe creates a block that groups several related
// tests into one test suite
describe('createMDXLoader caching behavior', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  // before AND after each test
  beforeEach(() => {
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalJestWorkerId !== undefined) {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    } else {
      delete process.env.JEST_WORKER_ID;
    }
  });

  // 1. caching is enabled in production mode
  it('enables crossCompileCache when use crossCompilerCache=true and NODE_ENV=production', async () => {
    // ARRANGE - set up the environment
    process.env.NODE_ENV = 'production';

    // ACT - call the function with specific options
    const result = (await createMDXLoaderItem({
      useCrossCompilerCache: true,
    } as any)) as any;

    // ASSERT - validate the results
    // expect lets you validate conditions in tests
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('loader' in result).toBe(true);
    expect(result.loader).toBe(require.resolve('@docusaurus/mdx-loader'));
    expect(typeof result.options).toBe('object');
    expect((result as any).options.crossCompilerCache).toBeInstanceOf(Map);
  });

  // 2. caching is disabled development mode, would cache old versions
  it('disables crossCompileCache when crossCompilerCache=true but NODE_ENV=development', async () => {
    // ARRANGE - set up the environment
    process.env.NODE_ENV = 'development';

    // ACT - call the function with specific options
    // await pauses async function until a promise is kept
    // Promise<RuleSetUseItem> in createMDXLoaderItem
    const result = (await createMDXLoaderItem({
      useCrossCompilerCache: true,
    } as any)) as any;

    // ASSERT - validate the results
    expect(typeof result).toBe('object');
    expect((result.options as any).crossCompilerCache).toBeUndefined();
  });

  // 3. caching is disabled when env is undefined
  it('disables crossCompilerCache when useCrossCompilerCache=true but NODE_ENV is undefined', async () => {
    // ARRANGE - set up the environment
    delete process.env.NODE_ENV;

    // ACT - call function with specific options
    const result = (await createMDXLoaderItem({
      useCrossCompilerCache: true,
    } as any)) as any;

    // ASSERT - validate the results
    expect(typeof result).toBe('object');
    expect((result.options as any).crossCompilerCache).toBeUndefined();
  });

  // 4. caching is disabled when useCrossCompilerCache is false, even in production
  it('disables crossCompilerCache when useCrossCompilerCache=false in production', async () => {
    // ARRANGE - set up the environment
    process.env.NODE_ENV = 'production';

    // ACT - call function with specific options
    const result = (await createMDXLoaderItem({
      useCrossCompilerCache: false,
    } as any)) as any;

    // ASSERT - validate the results
    expect(typeof result).toBe('object');
    expect((result.options as any).crossCompilerCache).toBeUndefined();
  });

  // 5.
  it('disables crossCompilerCache when useCrossCompilerCache is not provided', async () => {
    // ARRANGE - set up the environment
    process.env.NODE_ENV = 'production';

    // ACT - call the function with specific options
    const result = (await createMDXLoaderItem({} as any)) as any;

    // ASSERT - validate the results
    expect(typeof result.options).toBe('object');
    expect((result.options as any).crossCompilerCache).toBeUndefined();
  });
});
