import * as React from 'react';

export interface MarkdownProps {
  children?: React.ReactNode;
}

export default function DocsPage({
  children
}: MarkdownProps) {
  const anchors = React.Children.toArray(children)
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

    console.log(anchors)

  return (
    <>
        {children}
    </>
  );
}