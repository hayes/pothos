export function Toc({
    items,
    className
}: {
    className: string;
    items: {
        url: string;
        depth: number;
        text: any;
    }[]
}) {
    return <nav className={className}>
        <ol>
            {items.map(item => <li><a href={item.url}>{item.text}</a></li>)}
        </ol>
    </nav>
}