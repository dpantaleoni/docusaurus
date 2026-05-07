/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createContentHelpersFactory} from '../contentHelpersFactory';

describe('createContentHelpersFactory', () => {
  it('clears and repopulates both maps', () => {
    type Item = {source: string; permalink: string; title: string};
    type Content = {items: Item[]};

    const sourceToItem = new Map<string, Item>();
    const sourceToPermalink = new Map<string, string>();

    const {updateContent} = createContentHelpersFactory<
      Content,
      Item,
      typeof sourceToItem
    >({
      sourceToValue: sourceToItem,
      sourceToPermalink,
      createSourceToValue: (content) =>
        new Map(content.items.map((item) => [item.source, item])),
      getValuePermalink: (item) => item.permalink,
    });

    updateContent({
      items: [
        {source: '/a.mdx', permalink: '/a', title: 'A'},
        {source: '/b.mdx', permalink: '/b', title: 'B'},
      ],
    });

    expect(Array.from(sourceToItem.keys())).toEqual(['/a.mdx', '/b.mdx']);
    expect(sourceToItem.get('/a.mdx')?.title).toBe('A');
    expect(sourceToPermalink.get('/b.mdx')).toBe('/b');

    updateContent({
      items: [{source: '/c.mdx', permalink: '/c', title: 'C'}],
    });

    expect(Array.from(sourceToItem.keys())).toEqual(['/c.mdx']);
    expect(sourceToPermalink.size).toBe(1);
    expect(sourceToPermalink.get('/c.mdx')).toBe('/c');
    expect(sourceToPermalink.has('/a.mdx')).toBe(false);
  });
});
