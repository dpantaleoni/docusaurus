/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import dedent from 'dedent';
import {createExcerpt} from '../markdownUtils';

describe('createExcerpt (golden)', () => {
  const cases: {name: string; input: string}[] = [
    {
      name: 'empty',
      input: '',
    },
    {
      name: 'whitespace only',
      input: '   \n\n\t\n',
    },
    {
      name: 'text only',
      input: dedent`
        Hello world.

        Second paragraph.
      `,
    },
    {
      name: 'atx h1 skipped',
      input: dedent`
        # Title

        Content.
      `,
    },
    {
      name: 'setext h1 skipped',
      input: dedent`
        Title
        =====

        Content.
      `,
    },
    {
      name: 'h2 becomes excerpt (strip hashes)',
      input: dedent`
        ## Hello heading ##
      `,
    },
    {
      name: 'blockquote prefix stripped',
      input: dedent`
        > Quoted **text** with :wink: emoji.
      `,
    },
    {
      name: 'inline links/images/code/emphasis stripped',
      input: dedent`
        ![Alt img](/img/foo.png)
        [Link **bold**](https://example.com) and \`code\` and _em_.
      `,
    },
    {
      name: 'html tags stripped',
      input: dedent`
        <span>Hello</span> <b>world</b>.
      `,
    },
    {
      name: 'admonition fence lines skipped',
      input: dedent`
        :::note

        Content inside note.

        :::
      `,
    },
    {
      name: 'imports ignored until blank line',
      input: dedent`
        import A from 'a';
        import {
          B,
        } from 'b';
        export const x = 1;

        Content after imports.
      `,
    },
    {
      name: 'exports ignored until blank line',
      input: dedent`
        export function Foo() {
          return 42;
        }

        First paragraph.
      `,
    },
    {
      name: 'fenced code block ignored',
      input: dedent`
        \`\`\`js
        # Not a heading
        \`\`\`

        Real content.
      `,
    },
    {
      name: 'nested fences (```` with inner ``` treated as text)',
      input: dedent`
        \`\`\`\`js
        Foo
        \`\`\`diff
        not a fence close
        \`\`\`
        Bar
        \`\`\`\`

        After code.
      `,
    },
    {
      name: 'footnotes removed',
      input: dedent`
        Hello[^1] world.

        [^1]: footnote text
      `,
    },
    {
      name: 'strikethrough removed',
      input: dedent`
        This is ~~deleted~~ kept.
      `,
    },
    {
      name: 'custom heading id stripped',
      input: dedent`
        ## Heading {#my-anchor-id}
      `,
    },
    {
      name: 'emoji name removed',
      input: dedent`
        Hello :rocket: world.
      `,
    },
    {
      name: 'mdx jsx line becomes empty',
      input: dedent`
        <Component prop="x" />

        Actual text.
      `,
    },
    {
      name: 'CRLF import block + text',
      input: dedent`
        import A from 'a';

        Hello world.
      `.replace(/\n/g, '\r\n'),
    },
  ];

  it('matches the current behavior snapshot', () => {
    const results = Object.fromEntries(
      cases.map(({name, input}) => [name, createExcerpt(input)]),
    );
    expect(results).toMatchSnapshot();
  });
});
