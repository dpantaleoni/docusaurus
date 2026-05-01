/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import {
  aliasedSitePath,
  getEditUrl,
  getFolderContainingFile,
  getContentPathList,
  normalizeUrl,
  parseMarkdownFile,
  posixPath,
  Globby,
  isUnlisted,
  isDraft,
  readLastUpdateData,
  normalizeTags,
} from '@docusaurus/utils';
import {validateDocFrontMatter} from './frontMatter';
import getSlug from './slug';
import {stripPathNumberPrefixes} from './numberPrefix';
import {toDocNavigationLink, toNavigationLink} from './sidebars/utils';
import type {TagsFile} from '@docusaurus/utils';
import type {
  MetadataOptions,
  PluginOptions,
  CategoryIndexMatcher,
  DocMetadataBase,
  DocMetadata,
  PropNavigationLink,
  VersionMetadata,
  LoadedVersion,
  EditUrlFunction,
} from '@docusaurus/plugin-content-docs';
import type {LoadContext} from '@docusaurus/types';
import type {SidebarsUtils} from './sidebars/utils';
import type {DocFile} from './types';

type EditUrlContext = {
  relativeFilePath: string;
  contentPath: string;
  permalink: string;
  versionMetadata: VersionMetadata;
  locale: string;
  siteDir: string;
  editLocalizedFiles: boolean;
};

function resolveFunctionEditUrl(
  editUrl: EditUrlFunction,
  ctx: EditUrlContext,
): string | undefined {
  return editUrl({
    version: ctx.versionMetadata.versionName,
    versionDocsDirPath: posixPath(
      path.relative(ctx.siteDir, ctx.versionMetadata.contentPath),
    ),
    docPath: posixPath(ctx.relativeFilePath),
    permalink: ctx.permalink,
    locale: ctx.locale,
  });
}

function resolveStringEditUrl(
  editUrl: string,
  ctx: EditUrlContext,
): string | undefined {
  const isLocalized =
    typeof ctx.versionMetadata.contentPathLocalized !== 'undefined' &&
    ctx.contentPath === ctx.versionMetadata.contentPathLocalized;
  const baseVersionEditUrl =
    isLocalized && ctx.editLocalizedFiles
      ? ctx.versionMetadata.editUrlLocalized
      : ctx.versionMetadata.editUrl;

  return getEditUrl(ctx.relativeFilePath, baseVersionEditUrl);
}

function resolveEditUrl(
  editUrl: PluginOptions['editUrl'],
  ctx: EditUrlContext,
): string | undefined {
  if (typeof editUrl === 'function') {
    return resolveFunctionEditUrl(editUrl, ctx);
  }
  if (typeof editUrl === 'string') {
    return resolveStringEditUrl(editUrl, ctx);
  }
  return undefined;
}

export async function readDocFile(
  versionMetadata: Pick<
    VersionMetadata,
    'contentPath' | 'contentPathLocalized'
  >,
  source: string,
): Promise<DocFile> {
  const contentPath = await getFolderContainingFile(
    getContentPathList(versionMetadata),
    source,
  );

  const filePath = path.join(contentPath, source);

  const content = await fs.readFile(filePath, 'utf-8');
  return {source, content, contentPath, filePath};
}

export async function readVersionDocs(
  versionMetadata: VersionMetadata,
  options: Pick<
    PluginOptions,
    'include' | 'exclude' | 'showLastUpdateAuthor' | 'showLastUpdateTime'
  >,
): Promise<DocFile[]> {
  const sources = await Globby(options.include, {
    cwd: versionMetadata.contentPath,
    ignore: options.exclude,
  });
  return Promise.all(
    sources.map((source) => readDocFile(versionMetadata, source)),
  );
}

export type DocEnv = 'production' | 'development';

async function doProcessDocMetadata({
  docFile,
  versionMetadata,
  context,
  options,
  env,
  tagsFile,
}: {
  docFile: DocFile;
  versionMetadata: VersionMetadata;
  context: LoadContext;
  options: MetadataOptions;
  env: DocEnv;
  tagsFile: TagsFile | null;
}): Promise<DocMetadataBase> {
  const {source, content, contentPath, filePath} = docFile;
  const {
    siteDir,
    siteConfig: {
      markdown: {parseFrontMatter},
      future: {experimental_vcs: vcs},
    },
  } = context;

  const {
    frontMatter: unsafeFrontMatter,
    contentTitle,
    excerpt,
  } = await parseMarkdownFile({
    filePath,
    fileContent: content,
    parseFrontMatter,
  });
  const frontMatter = validateDocFrontMatter(unsafeFrontMatter);

  const {
    custom_edit_url: customEditURL,

    // Strip number prefixes by default
    // (01-MyFolder/01-MyDoc.md => MyFolder/MyDoc)
    // but allow to disable this behavior with front matter
    parse_number_prefixes: parseNumberPrefixes = true,
    last_update: lastUpdateFrontMatter,
  } = frontMatter;

  const lastUpdate = await readLastUpdateData(
    filePath,
    options,
    lastUpdateFrontMatter,
    vcs,
  );

  // E.g. api/plugins/myDoc -> myDoc; myDoc -> myDoc
  const sourceFileNameWithoutExtension = path.basename(
    source,
    path.extname(source),
  );

  // E.g. api/plugins/myDoc -> api/plugins; myDoc -> .
  const sourceDirName = path.dirname(source);

  const {filename: unprefixedFileName, numberPrefix} = parseNumberPrefixes
    ? options.numberPrefixParser(sourceFileNameWithoutExtension)
    : {filename: sourceFileNameWithoutExtension, numberPrefix: undefined};

  const baseID: string = frontMatter.id ?? unprefixedFileName;
  if (baseID.includes('/')) {
    throw new Error(`Document id "${baseID}" cannot include slash.`);
  }

  // For autogenerated sidebars, sidebar position can come from filename number
  // prefix or front matter
  const sidebarPosition: number | undefined =
    frontMatter.sidebar_position ?? numberPrefix;

  // TODO legacy retrocompatibility
  // I think it's bad to affect the front matter id with the dirname?
  function computeDirNameIdPrefix() {
    if (sourceDirName === '.') {
      return undefined;
    }
    // Eventually remove the number prefixes from intermediate directories
    return parseNumberPrefixes
      ? stripPathNumberPrefixes(sourceDirName, options.numberPrefixParser)
      : sourceDirName;
  }

  const id = [computeDirNameIdPrefix(), baseID].filter(Boolean).join('/');

  const docSlug = getSlug({
    baseID,
    source,
    sourceDirName,
    frontMatterSlug: frontMatter.slug,
    stripDirNumberPrefixes: parseNumberPrefixes,
    numberPrefixParser: options.numberPrefixParser,
  });

  // Note: the title is used by default for page title, sidebar label,
  // pagination buttons... frontMatter.title should be used in priority over
  // contentTitle (because it can contain markdown/JSX syntax)
  const title: string = frontMatter.title ?? contentTitle ?? baseID;

  const description: string = frontMatter.description ?? excerpt ?? '';

  const permalink = normalizeUrl([versionMetadata.path, docSlug]);

  const draft = isDraft({env, frontMatter});
  const unlisted = isUnlisted({env, frontMatter});

  const tags = normalizeTags({
    options,
    source,
    frontMatterTags: frontMatter.tags,
    tagsBaseRoutePath: versionMetadata.tagsPath,
    tagsFile,
  });

  const ctx: EditUrlContext = {
    relativeFilePath: path.relative(contentPath, filePath),
    contentPath,
    permalink,
    versionMetadata,
    locale: context.i18n.currentLocale,
    siteDir,
    editLocalizedFiles: options.editLocalizedFiles,
  };

  // Assign all of object properties during instantiation (if possible) for
  // NodeJS optimization.
  // Adding properties to object after instantiation will cause hidden
  // class transitions.
  return {
    id,
    title,
    description,
    source: aliasedSitePath(filePath, siteDir),
    sourceDirName,
    slug: docSlug,
    permalink,
    draft,
    unlisted,
    editUrl:
      customEditURL !== undefined
        ? customEditURL
        : resolveEditUrl(options.editUrl, ctx),
    tags,
    version: versionMetadata.versionName,
    lastUpdatedBy: lastUpdate.lastUpdatedBy,
    lastUpdatedAt: lastUpdate.lastUpdatedAt,
    sidebarPosition,
    frontMatter,
  };
}

export async function processDocMetadata(args: {
  docFile: DocFile;
  versionMetadata: VersionMetadata;
  context: LoadContext;
  options: MetadataOptions;
  env: DocEnv;
  tagsFile: TagsFile | null;
}): Promise<DocMetadataBase> {
  try {
    return await doProcessDocMetadata(args);
  } catch (err) {
    throw new Error(
      `Can't process doc metadata for doc at path path=${args.docFile.filePath} in version name=${args.versionMetadata.versionName}`,
      {cause: err as Error},
    );
  }
}

function getUnlistedIds(docs: DocMetadataBase[]): Set<string> {
  return new Set(docs.filter((doc) => doc.unlisted).map((doc) => doc.id));
}

export function addDocNavigation({
  docs,
  sidebarsUtils,
}: {
  docs: DocMetadataBase[];
  sidebarsUtils: SidebarsUtils;
}): LoadedVersion['docs'] {
  const docsById = createDocsByIdIndex(docs);
  const unlistedIds = getUnlistedIds(docs);

  // Add sidebar/next/previous to the docs
  function addNavData(doc: DocMetadataBase): DocMetadata {
    const navigation = sidebarsUtils.getDocNavigation({
      docId: doc.id,
      displayedSidebar: doc.frontMatter.displayed_sidebar,
      unlistedIds,
    });

    const toNavigationLinkByDocId = (
      docId: string | null | undefined,
      type: 'prev' | 'next',
    ): PropNavigationLink | undefined => {
      if (!docId) {
        return undefined;
      }
      const navDoc = docsById[docId];
      if (!navDoc) {
        // This could only happen if user provided the ID through front matter
        throw new Error(
          `Error when loading ${doc.id} in ${doc.sourceDirName}: the pagination_${type} front matter points to a non-existent ID ${docId}.`,
        );
      }
      // Gracefully handle explicitly providing an unlisted doc ID in production
      if (navDoc.unlisted) {
        return undefined;
      }
      return toDocNavigationLink(navDoc);
    };

    const previous =
      doc.frontMatter.pagination_prev !== undefined
        ? toNavigationLinkByDocId(doc.frontMatter.pagination_prev, 'prev')
        : toNavigationLink(navigation.previous, docsById);
    const next =
      doc.frontMatter.pagination_next !== undefined
        ? toNavigationLinkByDocId(doc.frontMatter.pagination_next, 'next')
        : toNavigationLink(navigation.next, docsById);

    return {...doc, sidebar: navigation.sidebarName, previous, next};
  }

  const docsWithNavigation = docs.map(addNavData);
  // Sort to ensure consistent output for tests
  docsWithNavigation.sort((a, b) => a.id.localeCompare(b.id));
  return docsWithNavigation;
}

/**
 * The "main doc" is the "version entry point"
 * We browse this doc by clicking on a version:
 * - the "home" doc (at '/docs/')
 * - the first doc of the first sidebar
 * - a random doc (if no docs are in any sidebar... edge case)
 */
export function getMainDocId({
  docs,
  sidebarsUtils,
}: {
  docs: DocMetadataBase[];
  sidebarsUtils: SidebarsUtils;
}): string {
  function getMainDoc(): DocMetadata {
    const versionHomeDoc = docs.find((doc) => doc.slug === '/');
    const firstDocIdOfFirstSidebar =
      sidebarsUtils.getFirstDocIdOfFirstSidebar();
    if (versionHomeDoc) {
      return versionHomeDoc;
    } else if (firstDocIdOfFirstSidebar) {
      return docs.find((doc) => doc.id === firstDocIdOfFirstSidebar)!;
    }
    return docs[0]!;
  }

  return getMainDoc().id;
}

// By convention, Docusaurus considers some docs are "indexes":
// - index.md
// - readme.md
// - <folder>/<folder>.md
//
// This function is the default implementation of this convention
//
// Those index docs produce a different behavior
// - Slugs do not end with a weird "/index" suffix
// - Auto-generated sidebar categories link to them as intro
export const isCategoryIndex: CategoryIndexMatcher = ({
  fileName,
  directories,
}): boolean => {
  const eligibleDocIndexNames = [
    'index',
    'readme',
    directories[0]?.toLowerCase(),
  ];
  return eligibleDocIndexNames.includes(fileName.toLowerCase());
};

/**
 * `guides/sidebar/autogenerated.md` ->
 *   `'autogenerated', '.md', ['sidebar', 'guides']`
 */
export function toCategoryIndexMatcherParam({
  source,
  sourceDirName,
}: Pick<
  DocMetadataBase,
  'source' | 'sourceDirName'
>): Parameters<CategoryIndexMatcher>[0] {
  // source + sourceDirName are always posix-style
  return {
    fileName: path.posix.parse(source).name,
    extension: path.posix.parse(source).ext,
    directories: sourceDirName.split(path.posix.sep).reverse(),
  };
}

// Docs are indexed by their id
export function createDocsByIdIndex<Doc extends {id: string}>(
  docs: Doc[],
): {[docId: string]: Doc} {
  return _.keyBy(docs, (d) => d.id);
}
