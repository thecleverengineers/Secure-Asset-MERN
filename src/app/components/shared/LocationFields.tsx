import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField, type TextFieldProps } from '@mui/material';
import { getLocationCities, getLocationCountries, getLocationStates, type LocationOption } from '../../services/api';

type LocationValue = { country?: string; state?: string; city?: string };
type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  required?: Partial<Record<keyof LocationValue, boolean>>;
  size?: TextFieldProps['size'];
  disabled?: boolean;
  labels?: Partial<Record<keyof LocationValue, string>>;
};

let countriesCache: LocationOption[] | null = null;
let countriesRequest: Promise<LocationOption[]> | null = null;
const statesCache = new Map<string, LocationOption[]>();
const citiesCache = new Map<string, LocationOption[]>();

async function countries() {
  if (countriesCache) return countriesCache;
  if (!countriesRequest) countriesRequest = getLocationCountries().then((response) => {
    countriesCache = response.data;
    return response.data;
  }).finally(() => { countriesRequest = null; });
  return countriesRequest;
}

async function states(countryCode: string) {
  if (statesCache.has(countryCode)) return statesCache.get(countryCode)!;
  const rows = (await getLocationStates(countryCode)).data;
  statesCache.set(countryCode, rows);
  return rows;
}

async function cities(countryCode: string, stateCode = '') {
  const key = `${countryCode}:${stateCode}`;
  if (citiesCache.has(key)) return citiesCache.get(key)!;
  const rows = (await getLocationCities(countryCode, stateCode)).data;
  citiesCache.set(key, rows);
  return rows;
}

function byNameOrCode(items: LocationOption[], value?: string) {
  const target = String(value || '').trim().toLowerCase();
  return items.find((item) => item.name.toLowerCase() === target || item.isoCode?.toLowerCase() === target) || null;
}

function preservedOption(value?: string, selected?: LocationOption | null): LocationOption | null {
  if (selected) return selected;
  return value ? { name: value } : null;
}

function optionLabel(option: LocationOption | string) {
  return typeof option === 'string' ? option : option.name;
}

export default function LocationFields({ value, onChange, required = {}, size = 'small', disabled, labels = {} }: Props) {
  const [countryOptions, setCountryOptions] = useState<LocationOption[]>(countriesCache || []);
  const [stateOptions, setStateOptions] = useState<LocationOption[]>([]);
  const [cityOptions, setCityOptions] = useState<LocationOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(!countriesCache);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState('');

  const countryMatch = useMemo(() => byNameOrCode(countryOptions, value.country), [countryOptions, value.country]);
  const stateMatch = useMemo(() => byNameOrCode(stateOptions, value.state), [stateOptions, value.state]);
  const cityMatch = useMemo(() => cityOptions.find((item) => item.name.toLowerCase() === String(value.city || '').trim().toLowerCase()) || null, [cityOptions, value.city]);

  useEffect(() => {
    let active = true;
    setLoadingCountries(true);
    countries().then((rows) => { if (active) setCountryOptions(rows); }).catch((caught) => { if (active) setError((caught as Error).message); }).finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const countryCode = countryMatch?.isoCode;
    if (!countryCode) { setStateOptions([]); setCityOptions([]); return; }
    let active = true;
    setLoadingStates(true);
    states(countryCode).then((rows) => { if (active) setStateOptions(rows); }).catch((caught) => { if (active) setError((caught as Error).message); }).finally(() => { if (active) setLoadingStates(false); });
    return () => { active = false; };
  }, [countryMatch?.isoCode]);

  useEffect(() => {
    const countryCode = countryMatch?.isoCode;
    if (!countryCode) { setCityOptions([]); return; }
    if (stateOptions.length && !stateMatch?.isoCode) { setCityOptions([]); return; }
    let active = true;
    setLoadingCities(true);
    cities(countryCode, stateMatch?.isoCode || '').then((rows) => { if (active) setCityOptions(rows); }).catch((caught) => { if (active) setError((caught as Error).message); }).finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [countryMatch?.isoCode, stateMatch?.isoCode, stateOptions.length]);

  return <>
    <Autocomplete
      options={countryOptions}
      value={preservedOption(value.country, countryMatch)}
      disabled={disabled}
      loading={loadingCountries}
      autoHighlight
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selected) => option.isoCode ? option.isoCode === selected.isoCode : option.name === selected.name}
      onChange={(_event, selected) => { setError(''); onChange({ country: selected?.name || '', state: '', city: '' }); }}
      renderInput={(params) => <TextField {...params} size={size} required={required.country} label={labels.country || 'Country'} error={Boolean(error)} helperText={error || undefined} InputProps={{ ...params.InputProps, endAdornment: <>{loadingCountries ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }} />}
    />
    <Autocomplete
      options={stateOptions}
      value={preservedOption(value.state, stateMatch)}
      freeSolo
      disabled={disabled || !countryMatch || loadingStates}
      loading={loadingStates}
      autoHighlight
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, selected) => option.isoCode ? option.isoCode === selected.isoCode && option.countryCode === selected.countryCode : option.name === selected.name}
      onChange={(_event, selected) => { setError(''); onChange({ ...value, country: countryMatch?.name || value.country || '', state: typeof selected === 'string' ? selected : selected?.name || '', city: '' }); }}
      onInputChange={(_event, next, reason) => { if (reason === 'input') onChange({ ...value, country: countryMatch?.name || value.country || '', state: next, city: '' }); }}
      noOptionsText={countryMatch ? 'No states or provinces found' : 'Select a country first'}
      renderInput={(params) => <TextField {...params} size={size} required={required.state} label={labels.state || 'State / Province'} InputProps={{ ...params.InputProps, endAdornment: <>{loadingStates ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }} />}
    />
    <Autocomplete
      options={cityOptions}
      value={preservedOption(value.city, cityMatch)}
      freeSolo
      disabled={disabled || !countryMatch || loadingCities}
      loading={loadingCities}
      autoHighlight
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, selected) => option.name === selected.name && option.stateCode === selected.stateCode && option.countryCode === selected.countryCode}
      onChange={(_event, selected) => { setError(''); onChange({ ...value, country: countryMatch?.name || value.country || '', state: stateMatch?.name || value.state || '', city: typeof selected === 'string' ? selected : selected?.name || '' }); }}
      onInputChange={(_event, next, reason) => { if (reason === 'input') onChange({ ...value, country: countryMatch?.name || value.country || '', state: stateMatch?.name || value.state || '', city: next }); }}
      noOptionsText={countryMatch ? 'No cities found for this location' : 'Select a country first'}
      renderInput={(params) => <TextField {...params} size={size} required={required.city} label={labels.city || 'City'} InputProps={{ ...params.InputProps, endAdornment: <>{loadingCities ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }} />}
    />
  </>;
}
