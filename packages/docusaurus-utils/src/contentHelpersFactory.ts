/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

type SourceToPermalink = Map<string, string>;

export type CreateContentHelpersFactoryParams<
  TContent,
  TValue,
  TValueMap extends Map<string, TValue>,
> = {
  sourceToValue: TValueMap;
  sourceToPermalink: SourceToPermalink;
  createSourceToValue: (content: TContent) => Map<string, TValue>;
  getValuePermalink: (value: TValue) => string;
};

export function createContentHelpersFactory<
  TContent,
  TValue,
  TValueMap extends Map<string, TValue>,
>({
  sourceToValue,
  sourceToPermalink,
  createSourceToValue,
  getValuePermalink,
}: CreateContentHelpersFactoryParams<TContent, TValue, TValueMap>): {
  updateContent: (content: TContent) => void;
} {
  function updateContent(content: TContent): void {
    sourceToValue.clear();
    sourceToPermalink.clear();

    createSourceToValue(content).forEach((value, source) => {
      sourceToValue.set(source, value);
      sourceToPermalink.set(source, getValuePermalink(value));
    });
  }

  return {updateContent};
}
