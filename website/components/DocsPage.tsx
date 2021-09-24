import { MDXProvider } from '@mdx-js/react'
import { Children, ReactNode } from 'react';
import { Toc } from './Toc';

export interface BaseProps {
  children: ReactNode
}

const components = { }

export function DocsPage({
  children
}: {children?: React.ReactNode}) {
  const items = Children.toArray(children)
    .filter(
      (child: any) =>
        child.props?.mdxType && ['h2', 'h3'].includes(child.props.mdxType)
    )
    .map((child: any) => ({
      url: '#' + child.props.id,
      depth:
        (child.props?.mdxType &&
          parseInt(child.props.mdxType.replace('h', ''), 0)) ??
        0,
      text: child.props.children,
    }));

  return (
    <MDXProvider components={components}>
      <Toc className="fixed top-20 ml-[800px]" items={items} />
      <div className="prose lg:prose-xl">
        {children}
      </div>
    </MDXProvider>
  );
}