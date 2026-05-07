/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import logger from '@docusaurus/logger';
import matter from 'gray-matter';
import jiti from 'jiti';
import {createSlugger, type Slugger, type SluggerOptions} from './slugger';
import type {Content, Root} from 'mdast';
import type {
  ParseFrontMatter,
  DefaultParseFrontMatter,
} from '@docusaurus/types';

// Some utilities for parsing Markdown content. These things are only used on
// server-side when we infer metadata like `title` and `description` from the
// content. Most parsing is still done in MDX through the mdx-loader.

/**
 * Parses custom ID from a heading. The ID can contain any characters except
 * `{#` and `}`.
 *
 * @param heading e.g. `## Some heading {#some-heading}` where the last
 * character must be `}` for the ID to be recognized
 */
export function parseMarkdownHeadingId(heading: string): {
  /**
   * The heading content sans the ID part, right-trimmed. e.g. `## Some heading`
   */
  text: string;
  /** The heading ID. e.g. `some-heading` */
  id: string | undefined;
} {
  const customHeadingIdRegex = /\s*\{#(?<id>(?:.(?!\{#|\}))*.)\}$/;
  const matches = customHeadingIdRegex.exec(heading);
  if (matches) {
    return {
      text: heading.replace(matches[0]!, ''),
      id: matches.groups!.id!,
    };
  }
  return {text: heading, id: undefined};
}

/**
 * MDX 2 requires escaping { with a \ so our anchor syntax need that now.
 * See https://mdxjs.com/docs/troubleshooting-mdx/#could-not-parse-expression-with-acorn-error
 */
export function escapeMarkdownHeadingIds(content: string): string {
  const markdownHeadingRegexp = /(?:^|\n)#{1,6}(?!#).*/g;
  return content.replaceAll(markdownHeadingRegexp, (substring) =>
    // TODO probably not the most efficient impl...
    substring
      .replace('{#', '\\{#')
      // prevent duplicate escaping
      .replace('\\\\{#', '\\{#'),
  );
}

/**
 * Hacky temporary escape hatch for Crowdin bad MDX support
 * See https://docusaurus.io/docs/i18n/crowdin#mdx
 *
 * TODO Titus suggested a clean solution based on ```mdx eval and Remark
 * See https://github.com/mdx-js/mdx/issues/701#issuecomment-947030041
 *
 * @param content
 */
export function unwrapMdxCodeBlocks(content: string): string {
  // We only support 3/4 backticks on purpose, should be good enough
  const regexp3 =
    /(?<begin>^|\r?\n)(?<indentStart>\x20*)```(?<spaces>\x20*)mdx-code-block\r?\n(?<children>.*?)\r?\n(?<indentEnd>\x20*)```(?<end>\r?\n|$)/gs;
  const regexp4 =
    /(?<begin>^|\r?\n)(?<indentStart>\x20*)````(?<spaces>\x20*)mdx-code-block\r?\n(?<children>.*?)\r?\n(?<indentEnd>\x20*)````(?<end>\r?\n|$)/gs;

  type MdxCodeBlockGroups = {
    begin: string;
    children: string;
    end: string;
  };

  const replacer = (_substring: string, ..._args: unknown[]): string => {
    const groups = _args.at(-1) as MdxCodeBlockGroups;
    return `${groups.begin}${groups.children}${groups.end}`;
  };

  return content.replaceAll(regexp3, replacer).replaceAll(regexp4, replacer);
}

/**
 * Add support for our legacy ":::note Title" admonition syntax
 * Not supported by https://github.com/remarkjs/remark-directive
 * Syntax is transformed to ":::note[Title]" (container directive label)
 * See https://talk.commonmark.org/t/generic-directives-plugins-syntax/444
 *
 * @param content
 * @param admonitionContainerDirectives
 */
export function admonitionTitleToDirectiveLabel(
  content: string,
  admonitionContainerDirectives: string[],
): string {
  // this will also process ":::note Title" inside docs code blocks
  // good enough: we fixed older versions docs to not be affected

  const directiveNameGroup = `(${admonitionContainerDirectives.join('|')})`;
  const regexp = new RegExp(
    `^(?<quote>(> ?)*)(?<indentation>( +|\t+))?(?<directive>:{3,}${directiveNameGroup}) +(?<title>.*)$`,
    'gm',
  );

  type AdmonitionTitleGroups = {
    quote: string | undefined;
    indentation: string | undefined;
    directive: string;
    title: string;
  };

  return content.replaceAll(
    regexp,
    (_substring: string, ..._args: unknown[]) => {
      const groups = _args.at(-1) as AdmonitionTitleGroups;

      return `${groups.quote ?? ''}${groups.indentation ?? ''}${
        groups.directive
      }[${groups.title}]`;
    },
  );
}

// TODO: Find a better way to do so, possibly by compiling the Markdown content,
// stripping out HTML tags and obtaining the first line.
/**
 * Creates an excerpt of a Markdown file. This function will:
 *
 * - Ignore h1 headings (setext or atx)
 * - Ignore import/export
 * - Ignore code blocks
 *
 * And for the first contentful line, it will strip away most Markdown
 * syntax, including HTML tags, emphasis, links (keeping the text), etc.
 */
type RemarkExcerptAdapter = {
  parse: (content: string) => Root;
  toString: (node: unknown) => string;
};

let remarkExcerptAdapter: RemarkExcerptAdapter | undefined;

function getRemarkExcerptAdapter(): RemarkExcerptAdapter {
  if (remarkExcerptAdapter) {
    return remarkExcerptAdapter;
  }

  // remark/unified packages are ESM in recent versions; load them in a
  // CommonJS-friendly way (Jest, Node).
  const load = jiti(__filename, {cache: true, interopDefault: false});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unified = ((load('unified') as any).unified ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (load('unified') as any).default
      ?.unified) as unknown as typeof import('unified').unified;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remarkParse = ((load('remark-parse') as any).default ??
    (load(
      'remark-parse',
    ) as any)) as unknown as typeof import('remark-parse').default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remarkGfm = ((load('remark-gfm') as any).default ??
    (load(
      'remark-gfm',
    ) as any)) as unknown as typeof import('remark-gfm').default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toString = ((load('mdast-util-to-string') as any).toString ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (load('mdast-util-to-string') as any).default
      ?.toString) as unknown as typeof import('mdast-util-to-string').toString;

  const processor = unified().use(remarkParse).use(remarkGfm);

  remarkExcerptAdapter = {
    parse: (content) => processor.parse(content) as Root,
    toString,
  };

  return remarkExcerptAdapter;
}

export function createExcerpt(fileString: string): string | undefined {
  const {parse, toString} = getRemarkExcerptAdapter();

  function stripImportExport(content: string): string {
    const lines = content.split(/\r?\n/);
    const output: string[] = [];
    let inImport = false;
    let inCode = false;
    let lastCodeFence = '';

    for (const line of lines) {
      // Track fenced code blocks; imports/exports inside should be preserved.
      if (line.trim().startsWith('```')) {
        const codeFence = line.trim().match(/^`+/)?.[0] ?? '```';
        if (!inCode) {
          inCode = true;
          lastCodeFence = codeFence;
        } else if (codeFence.length >= lastCodeFence.length) {
          inCode = false;
        }
        output.push(line);
        continue;
      }

      if (inCode) {
        output.push(line);
        continue;
      }

      // An empty line marks the end of imports.
      if (!line.trim() && inImport) {
        inImport = false;
        output.push(line);
        continue;
      }

      if ((/^(?:import|export)\s.*/.test(line) || inImport) && !inCode) {
        inImport = true;
        continue;
      }

      output.push(line);
    }

    return output.join('\n');
  }

  function cleanupText(text: string): string {
    return (
      text
        // Remove HTML tags.
        .replace(/<[^>]*>/g, '')
        // Remove footnotes.
        .replace(/\[\^.+?\](?:: .*$)?/g, '')
        // Remove admonition definition.
        .replace(/:::.*/g, '')
        // Remove Emoji names within colons include preceding whitespace.
        .replace(/\s?:(?:::|[^:\n])+:/g, '')
        // Remove custom Markdown heading id.
        .replace(/\{#*[\w-]+\}/g, '')
        .trim()
    );
  }

  function toFirstLine(text: string): string | undefined {
    const firstLine = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    return firstLine || undefined;
  }

  function findFirstContentfulText(node: Content): string | undefined {
    // Ignore h1 headings.
    if (node.type === 'heading' && node.depth === 1) {
      return undefined;
    }
    // Ignore fenced/indented code blocks.
    if (node.type === 'code') {
      return undefined;
    }

    // Skip directive fence lines like ":::note"/":::"
    if (node.type === 'paragraph') {
      const raw = toString(node).trim();
      if (raw.startsWith(':::')) {
        return undefined;
      }
    }

    // Handle common leaf-ish nodes.
    if (node.type === 'paragraph' || node.type === 'heading') {
      return toFirstLine(cleanupText(toString(node)));
    }

    // Recurse into containers in source order.
    if (
      node.type === 'blockquote' ||
      node.type === 'list' ||
      node.type === 'listItem'
    ) {
      const children = node.children as Content[];
      for (const child of children) {
        const text = findFirstContentfulText(child);
        if (text) {
          return text;
        }
      }
      return undefined;
    }

    // Fallback: use textual representation.
    return toFirstLine(cleanupText(toString(node)));
  }

  const content = fileString
    .trimStart()
    // Remove Markdown alternate title (setext h1 underline).
    .replace(/^[^\r\n]*\r?\n[=]+/g, '')
    // Strip HTML tags early so the AST text extraction keeps inner text.
    .replace(/<[^>]*>/g, '');

  const tree = parse(stripImportExport(content));

  for (const child of tree.children as Content[]) {
    const text = findFirstContentfulText(child);
    if (text) {
      return text;
    }
  }

  return undefined;
}

/**
 * Takes a raw Markdown file content, and parses the front matter using
 * gray-matter. Worth noting that gray-matter accepts TOML and other markup
 * languages as well.
 *
 * @throws Throws when gray-matter throws. e.g.:
 * ```md
 * ---
 * foo: : bar
 * ---
 * ```
 */
export function parseFileContentFrontMatter(fileContent: string): {
  /** Front matter as parsed by gray-matter. */
  frontMatter: {[key: string]: unknown};
  /** The remaining content, trimmed. */
  content: string;
} {
  // TODO Docusaurus v4: replace gray-matter by a better lib
  // gray-matter is unmaintained, not flexible, and the code doesn't look good
  const {data, content} = matter(fileContent);

  // gray-matter has an undocumented front matter caching behavior
  // https://github.com/jonschlinkert/gray-matter/blob/ce67a86dba419381db0dd01cc84e2d30a1d1e6a5/index.js#L39
  // Unfortunately, this becomes a problem when we mutate returned front matter
  // We want to make it possible as part of the parseFrontMatter API
  // So we make it safe to mutate by always providing a deep copy
  const frontMatter =
    // And of course structuredClone() doesn't work well with Date in Jest...
    // See https://github.com/jestjs/jest/issues/2549
    // So we parse again for tests with a {} option object
    // This undocumented empty option object disables gray-matter caching..
    process.env.JEST_WORKER_ID
      ? matter(fileContent, {}).data
      : structuredClone(data);

  return {
    frontMatter,
    content: content.trim(),
  };
}

export const DEFAULT_PARSE_FRONT_MATTER: DefaultParseFrontMatter = async (
  params,
) => parseFileContentFrontMatter(params.fileContent);

function toTextContentTitle(contentTitle: string): string {
  return contentTitle.replace(/`(?<text>[^`]*)`/g, '$<text>');
}

type ParseMarkdownContentTitleOptions = {
  /**
   * If `true`, the matching title will be removed from the returned content.
   * We can promise that at least one empty line will be left between the
   * content before and after, but you shouldn't make too much assumption
   * about what's left.
   */
  removeContentTitle?: boolean;
};

/**
 * Takes the raw Markdown content, without front matter, and tries to find an h1
 * title (setext or atx) to be used as metadata.
 *
 * It only searches until the first contentful paragraph, ignoring import/export
 * declarations.
 *
 * It will try to convert markdown to reasonable text, but won't be best effort,
 * since it's only used as a fallback when `frontMatter.title` is not provided.
 * For now, we just unwrap inline code (``# `config.js` `` => `config.js`).
 */
export function parseMarkdownContentTitle(
  contentUntrimmed: string,
  options?: ParseMarkdownContentTitleOptions,
): {
  /** The content, optionally without the content title. */
  content: string;
  /** The title, trimmed and without the `#`. */
  contentTitle: string | undefined;
} {
  const removeContentTitleOption = options?.removeContentTitle ?? false;

  const content = contentUntrimmed.trim();
  // We only need to detect import statements that will be parsed by MDX as
  // `import` nodes, as broken syntax can't render anyways. That means any block
  // that has `import` at the very beginning and surrounded by empty lines.
  const contentWithoutImport = content
    .replace(/^(?:import\s(?:.|\r?\n(?!\r?\n))*(?:\r?\n){2,})*/, '')
    .trim();

  const regularTitleMatch = /^#[ \t]+(?<title>[^ \t].*)(?:\r?\n|$)/.exec(
    contentWithoutImport,
  );
  const alternateTitleMatch = /^(?<title>.*)\r?\n=+(?:\r?\n|$)/.exec(
    contentWithoutImport,
  );

  const titleMatch = regularTitleMatch ?? alternateTitleMatch;
  if (!titleMatch) {
    return {content, contentTitle: undefined};
  }
  const newContent = removeContentTitleOption
    ? content.replace(titleMatch[0]!, '')
    : content;
  if (regularTitleMatch) {
    return {
      content: newContent.trim(),
      contentTitle: toTextContentTitle(
        regularTitleMatch
          .groups!.title!.trim()
          .replace(/\s*(?:\{#*[\w-]+\}|#+)$/, ''),
      ).trim(),
    };
  }
  return {
    content: newContent.trim(),
    contentTitle: toTextContentTitle(
      alternateTitleMatch!.groups!.title!.trim().replace(/\s*=+$/, ''),
    ).trim(),
  };
}

/**
 * Makes a full-round parse.
 *
 * @throws Throws when `parseFrontMatter` throws, usually because of invalid
 * syntax.
 */
export async function parseMarkdownFile({
  filePath,
  fileContent,
  parseFrontMatter,
  removeContentTitle,
}: {
  filePath: string;
  fileContent: string;
  parseFrontMatter: ParseFrontMatter;
} & ParseMarkdownContentTitleOptions): Promise<{
  /** @see {@link parseFrontMatter} */
  frontMatter: {[key: string]: unknown};
  /** @see {@link parseMarkdownContentTitle} */
  contentTitle: string | undefined;
  /** @see {@link createExcerpt} */
  excerpt: string | undefined;
  /**
   * Content without front matter and (optionally) without title, depending on
   * the `removeContentTitle` option.
   */
  content: string;
}> {
  try {
    const {frontMatter, content: contentWithoutFrontMatter} =
      await parseFrontMatter({
        filePath,
        fileContent,
        defaultParseFrontMatter: DEFAULT_PARSE_FRONT_MATTER,
      });

    const {content, contentTitle} = parseMarkdownContentTitle(
      contentWithoutFrontMatter,
      {removeContentTitle},
    );

    const excerpt = createExcerpt(content);

    return {
      frontMatter,
      content,
      contentTitle,
      excerpt,
    };
  } catch (err) {
    logger.error(`Error while parsing Markdown front matter.
This can happen if you use special characters in front matter values (try using double quotes around that value).`);
    throw err;
  }
}

function unwrapMarkdownLinks(line: string): string {
  return line.replace(
    /\[(?<alt>[^\]]+)\]\([^)]+\)/g,
    (match, p1: string) => p1,
  );
}

function addHeadingId(
  line: string,
  slugger: Slugger,
  maintainCase: boolean,
): string {
  let headingLevel = 0;
  while (line.charAt(headingLevel) === '#') {
    headingLevel += 1;
  }

  const headingText = line.slice(headingLevel).trimEnd();
  const headingHashes = line.slice(0, headingLevel);
  const slug = slugger.slug(unwrapMarkdownLinks(headingText).trim(), {
    maintainCase,
  });

  return `${headingHashes}${headingText} {#${slug}}`;
}

export type WriteHeadingIDOptions = SluggerOptions & {
  /** Overwrite existing heading IDs. */
  overwrite?: boolean;
};

/**
 * Takes Markdown content, returns new content with heading IDs written.
 * Respects existing IDs (unless `overwrite=true`) and never generates colliding
 * IDs (through the slugger).
 */
export function writeMarkdownHeadingId(
  content: string,
  options: WriteHeadingIDOptions = {maintainCase: false, overwrite: false},
): string {
  const {maintainCase = false, overwrite = false} = options;
  const lines = content.split('\n');
  const slugger = createSlugger();

  // If we can't overwrite existing slugs, make sure other headings don't
  // generate colliding slugs by first marking these slugs as occupied
  if (!overwrite) {
    lines.forEach((line) => {
      const parsedHeading = parseMarkdownHeadingId(line);
      if (parsedHeading.id) {
        slugger.slug(parsedHeading.id);
      }
    });
  }

  let inCode = false;
  return lines
    .map((line) => {
      if (line.startsWith('```')) {
        inCode = !inCode;
        return line;
      }
      // Ignore h1 headings, as we don't create anchor links for those
      if (inCode || !line.startsWith('##')) {
        return line;
      }
      const parsedHeading = parseMarkdownHeadingId(line);

      // Do not process if id is already there
      if (parsedHeading.id && !overwrite) {
        return line;
      }
      return addHeadingId(parsedHeading.text, slugger, maintainCase);
    })
    .join('\n');
}
