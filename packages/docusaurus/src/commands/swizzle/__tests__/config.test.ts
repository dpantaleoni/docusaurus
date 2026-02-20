/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {normalizeSwizzleConfig, getModuleSwizzleConfig} from '../config';
import type {SwizzleConfig} from '@docusaurus/types';

describe('normalizeSwizzleConfig', () => {
  it(`validate no components config`, () => {
    const config: SwizzleConfig = {
      components: {},
    };
    expect(normalizeSwizzleConfig(config)).toEqual(config);
  });

  it(`validate complete config`, () => {
    const config: SwizzleConfig = {
      components: {
        SomeComponent: {
          actions: {
            wrap: 'safe',
            eject: 'unsafe',
          },
          description: 'SomeComponent description',
        },
        'Other/Component': {
          actions: {
            wrap: 'forbidden',
            eject: 'unsafe',
          },
          description: 'Other/Component description',
        },
      },
    };
    expect(normalizeSwizzleConfig(config)).toEqual(config);
  });

  it(`normalize partial config`, () => {
    const config: SwizzleConfig = {
      components: {
        SomeComponent: {
          // @ts-expect-error: incomplete actions map
          actions: {
            eject: 'safe',
          },
          description: 'SomeComponent description',
        },
        'Other/Component': {
          // @ts-expect-error: incomplete actions map
          actions: {
            wrap: 'forbidden',
          },
        },
      },
    };
    expect(normalizeSwizzleConfig(config)).toMatchSnapshot();
  });

  it(`reject missing components`, () => {
    // @ts-expect-error: incomplete actions map
    const config: SwizzleConfig = {};

    expect(() =>
      normalizeSwizzleConfig(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Swizzle config does not match expected schema: "components" is required"`,
    );
  });

  it(`reject invalid action name`, () => {
    const config: SwizzleConfig = {
      components: {
        MyComponent: {
          actions: {
            wrap: 'safe',
            eject: 'unsafe',
            // @ts-expect-error: on purpose
            bad: 'safe',
          },
        },
      },
    };

    expect(() =>
      normalizeSwizzleConfig(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Swizzle config does not match expected schema: "components.MyComponent.actions.bad" is not allowed"`,
    );
  });

  it(`reject invalid action status`, () => {
    const config: SwizzleConfig = {
      components: {
        MyComponent: {
          actions: {
            wrap: 'safe',
            // @ts-expect-error: on purpose
            eject: 'invalid-status',
          },
        },
      },
    };

    expect(() =>
      normalizeSwizzleConfig(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Swizzle config does not match expected schema: "components.MyComponent.actions.eject" must be one of [safe, unsafe, forbidden]"`,
    );
  });

  // 1. accepts component with no actions object
  it(`accept component with no actions object`, () => {
    const raw = {
      components: {
        // no actions object
        MyComponent: {},
      },
    } as unknown as SwizzleConfig;
    const result = normalizeSwizzleConfig(raw);
    expect(result).toEqual({
      components: {
        MyComponent: {
          actions: {
            eject: 'unsafe',
            wrap: 'unsafe',
          },
        },
      },
    });
  });

  // 2. accepts components with no description field
  it(`accepts components with no description field`, () => {
    const raw = {
      components: {
        MyComponent: {
          actions: {
            wrap: 'safe',
            eject: 'unsafe',
          },
        },
      },
    } as unknown as SwizzleConfig;
    const result = normalizeSwizzleConfig(raw);
    expect(result).toEqual({
      components: {
        MyComponent: {
          actions: {
            wrap: 'safe',
            eject: 'unsafe',
          },
        },
      },
    });
  });

  // 3. accepts components with partial config
  it(`accepts component with empty actions object`, () => {
    const raw = {
      components: {
        MyComponent: {
          actions: {
            wrap: 'safe',
          },
        },
      },
    } as unknown as SwizzleConfig;
    const result = normalizeSwizzleConfig(raw);
    expect(result.components.MyComponent.actions).toBeDefined();
  });
});

describe('getModuleSwizzleConfig', () => {
  // 4.
  it(`getSwizzleComponentList valid config with empty components`, () => {
    const mockPlugin = {
      plugin: {
        plugin: {
          getSwizzleConfig: () => ({
            components: {},
          }),
        },
      },
    } as Parameters<typeof getModuleSwizzleConfig>[0];

    const result = getModuleSwizzleConfig(mockPlugin);
    expect(result).toEqual({components: {}});
  });

  // 5.
  it(`returns undefined when no swizzle methods are provided`, () => {
    const mockPlugin = {
      plugin: {
        plugin: {},
      },
    } as Parameters<typeof getModuleSwizzleConfig>[0];

    const result = getModuleSwizzleConfig(mockPlugin);

    expect(result).toBeUndefined();
  });
});
