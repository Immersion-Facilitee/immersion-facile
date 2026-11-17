import Styles from "./EventPayloadTree.styles";

type PayloadEntry = [string, unknown];

const isNonEmptyObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && Object.keys(value).length > 0;

const toEntries = (value: object): PayloadEntry[] =>
  Array.isArray(value)
    ? value.map((item, index): PayloadEntry => [String(index), item])
    : Object.entries(value);

const toCollapsedPreview = (value: object): string => {
  const count = Object.keys(value).length;
  return Array.isArray(value)
    ? `[…] ${count} élément${count > 1 ? "s" : ""}`
    : `{…} ${count} clé${count > 1 ? "s" : ""}`;
};

const PayloadValue = ({ value }: { value: unknown }): React.ReactNode => {
  if (value === null) return <span className={Styles.null}>null</span>;
  if (typeof value === "string")
    return <span className={Styles.string}>"{value}"</span>;
  if (typeof value === "number")
    return <span className={Styles.number}>{value}</span>;
  if (typeof value === "boolean")
    return <span className={Styles.boolean}>{String(value)}</span>;
  if (Array.isArray(value)) return <span className={Styles.null}>[]</span>;
  if (typeof value === "object")
    return <span className={Styles.null}>{"{}"}</span>;
  return <span className={Styles.null}>{String(value)}</span>;
};

const PayloadEntries = ({ value }: { value: object }): React.ReactNode =>
  toEntries(value).map(([name, entryValue]) => (
    <PayloadNode
      key={name}
      name={name}
      isArrayItem={Array.isArray(value)}
      value={entryValue}
    />
  ));

const PayloadNode = ({
  name,
  isArrayItem,
  value,
}: {
  name: string;
  isArrayItem: boolean;
  value: unknown;
}): React.ReactNode => {
  const label = (
    <span className={isArrayItem ? Styles.index : Styles.key}>{name}</span>
  );

  if (!isNonEmptyObject(value))
    return (
      <div className={Styles.leaf}>
        {label}: <PayloadValue value={value} />
      </div>
    );

  return (
    <details>
      <summary className={Styles.summary}>
        <span>{label}:</span>
        <span className={Styles.preview}>{toCollapsedPreview(value)}</span>
      </summary>
      <div className={Styles.children}>
        <PayloadEntries value={value} />
      </div>
    </details>
  );
};

export const EventPayloadTree = ({
  payload,
}: {
  payload: unknown;
}): React.ReactNode => (
  <div className={Styles.root}>
    {isNonEmptyObject(payload) ? (
      <PayloadEntries value={payload} />
    ) : (
      <PayloadValue value={payload} />
    )}
  </div>
);
