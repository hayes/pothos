/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-process-exit */
/* eslint-disable @typescript-eslint/no-implicit-any-catch */
// import algoliasearch from 'algoliasearch/lite';
import dotenv from 'dotenv';

try {
  dotenv.config();

  if (!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID) {
    throw new Error('NEXT_PUBLIC_ALGOLIA_APP_ID is not defined');
  }

  if (!process.env.ALGOLIA_SEARCH_ADMIN_KEY) {
    throw new Error('ALGOLIA_SEARCH_ADMIN_KEY is not defined');
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}

// const searchFormat = loadedFiles.map((file) => {
//   if (!(file.data.title as string)) {
//     throw new Error(`Missing title for ${file.path}`);
//   }

//   return {
//     objectID: file.path,
//     title: file.data.title as string,
//     description: file.data.description as string,
//     slug: (file.data.slug as string) || toSlug(file.path),
//     tagsCollection: { tags: file.data.tags as string[] },
//     date: file.data.date as string,
//     type: 'docs',
//     content: file.content,
//   };
// });
