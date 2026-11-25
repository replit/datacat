export function CatMark({ size = 28 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={size} height={size} alt="DataCat" />;
}
