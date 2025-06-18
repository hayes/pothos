import gql from 'graphql-tag';
import styles from '../styles/Home.module.css';
import { useLoadPostsQuery } from './__generated__/Posts.generated';

export const postsQuery = gql`
  query loadPosts {
    posts(take: 4) {
      id
      title
      content
    }
  }
`;

export function Posts() {
  const { loading, error, data } = useLoadPostsQuery();

  if (loading) {
    return null;
  }

  if (error) {
    <pre>{JSON.stringify(error, null, 2)}</pre>;
  }

  return (
    <div className={styles.grid}>
      {data?.posts?.map((post, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: this is fine
        <div key={i} className={styles.card}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
}
