/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createExcerpt} from '../markdownUtils';

describe('createExcerpt (golden)', () => {
  const cases: Record<string, string> = {
    empty: '',
    'whitespace only': '   \n\n\t\n',
    'text only': 'Hello world.\n\nSecond paragraph.',
    'atx h1 skipped': '# Title\n\nContent.',
    'setext h1 skipped': 'Title\n=====\n\nContent.',
    'h2 becomes excerpt (strip hashes)': '## Hello heading ##',
    'blockquote prefix stripped': '> Quoted **text** with :wink: emoji.',
    'inline links/images/code/emphasis stripped':
      '![Alt img](/img/foo.png)\n[Link **bold**](https://example.com) and `code` and _em_.',
    'html tags stripped': '<span>Hello</span> <b>world</b>.',
    'admonition fence lines skipped': ':::note\n\nContent inside note.\n\n:::',
    'imports ignored until blank line':
      "import A from 'a';\nexport const x = 1;\n\nContent after imports.",
    'fenced code block ignored': '```js\n# Not a heading\n```\n\nReal content.',
    'nested fences (```` with inner ``` treated as text)':
      '````js\nFoo\n```diff\nnot a fence close\n```\nBar\n````\n\nAfter code.',
    'footnotes removed': 'Hello[^1] world.\n\n[^1]: footnote text',
    'mdx jsx line becomes empty': '<Component prop="x" />\n\nActual text.',
  };

  it('matches the current behavior snapshot', () => {
    const results = Object.fromEntries(
      Object.entries(cases).map(([name, input]) => [
        name,
        createExcerpt(input),
      ]),
    );
    expect(results).toMatchSnapshot();
  });
});
