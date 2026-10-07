// Town-level representative points, not parcel ownership or street-number matching.
export async function findMunicipalAddresses(code, query, fetcher = fetch) {
  if (!['08201','08216'].includes(code)) return [];
  const city = code === '08201' ? '水戸市' : '笠間市';
  const term = String(query || '').normalize('NFKC').replace(/\s/g,'').replace(/^茨城県/, '').replace(city,'');
  if (!term) return [];
  const response = await fetcher(`data/addresses/${code}.json`);
  if (!response.ok) throw Error('住所データを読み込めませんでした');
  return (await response.json()).filter(row => {
    const name = `${row.town || ''}${row.koaza || ''}`.normalize('NFKC');
    return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) && (name.includes(term) || term.startsWith(name));
  }).slice(0,15).map(row => ({name:city+row.town+(row.koaza||''),center:[Number(row.lng),Number(row.lat)]}));
}
