/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Router from '@docusaurus/router';
import {renderHook} from '@testing-library/react';
import {
  groupBlogSidebarItemsByYear,
  isVisible,
  useVisibleBlogSidebarItems,
} from './sidebarUtils';
import type {BlogSidebarItem} from '@docusaurus/plugin-content-blog';

jest.mock('@docusaurus/router', () => ({
  useLocation: jest.fn(),
}));

describe('groupBlogSidebarItemsByYear', () => {
  const post1: BlogSidebarItem = {
    title: 'post1',
    permalink: '/post1',
    date: '2024-10-03',
    unlisted: false,
  };

  const post2: BlogSidebarItem = {
    title: 'post2',
    permalink: '/post2',
    date: '2024-05-02',
    unlisted: false,
  };

  const post3: BlogSidebarItem = {
    title: 'post3',
    permalink: '/post3',
    date: '2022-11-18',
    unlisted: false,
  };

  it('can group items by year', () => {
    const items: BlogSidebarItem[] = [post1, post2, post3];
    const entries = groupBlogSidebarItemsByYear(items);

    expect(entries).toEqual([
      ['2024', [post1, post2]],
      ['2022', [post3]],
    ]);
  });

  it('always returns result in descending chronological order', () => {
    const items: BlogSidebarItem[] = [post3, post1, post2];
    const entries = groupBlogSidebarItemsByYear(items);

    expect(entries).toEqual([
      ['2024', [post1, post2]],
      ['2022', [post3]],
    ]);
  });
});

describe('isVisible', () => {
  const baseItem: BlogSidebarItem = {
    title: 'post',
    permalink: '/post',
    date: '2024-01-01',
    unlisted: false,
  };

  it('returns true for listed items', () => {
    const result = isVisible(baseItem, '/any');
    expect(result).toBe(true);
  });

  it('returns false for unlisted item when pathname does not match', () => {
    const item: BlogSidebarItem = {
      ...baseItem,
      unlisted: true,
    };

    const result = isVisible(item, '/other');
    expect(result).toBe(false);
  });

  it('returns true for unlisted item when pathname matches', () => {
    const item: BlogSidebarItem = {
      ...baseItem,
      unlisted: true,
    };

    const result = isVisible(item, '/post');
    expect(result).toBe(true);
  });
});

describe('useVisibleBlogSidebarItems', () => {
  const post1: BlogSidebarItem = {
    title: 'post1',
    permalink: '/post1',
    date: '2024-01-01',
    unlisted: false,
  };

  const post2: BlogSidebarItem = {
    title: 'post2',
    permalink: '/post2',
    date: '2024-01-02',
    unlisted: true,
  };

  const mockedUseLocation = jest.mocked(Router.useLocation);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out unlisted items when pathname does not match', () => {
    mockedUseLocation.mockReturnValue({pathname: '/other'} as any);

    const {result} = renderHook(() =>
      useVisibleBlogSidebarItems([post1, post2]),
    );

    expect(result.current).toEqual([post1]);
  });

  it('keeps unlisted item when pathname matches permalink', () => {
    mockedUseLocation.mockReturnValue({pathname: '/post2'} as any);

    const {result} = renderHook(() =>
      useVisibleBlogSidebarItems([post1, post2]),
    );

    expect(result.current).toEqual([post1, post2]);
  });
});
