interface Props {
  description: string;
  stepTitle?: string;
}

export function GuideDescription({ description, stepTitle }: Props) {
  const instructions = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="min-w-0 flex-[1_1_32rem] leading-relaxed">
      {stepTitle && <strong className="sm:hidden">{stepTitle}. </strong>}
      {instructions.length > 1 ? (
        <ul className="grid list-disc gap-x-8 gap-y-1 pl-4 md:grid-cols-2">
          {instructions.map((instruction) => (
            <li key={instruction} className="min-w-0 break-words">
              {instruction}
            </li>
          ))}
        </ul>
      ) : (
        <p>{description}</p>
      )}
    </div>
  );
}
