import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSiteConfig } from '../services/api';
import { DEFAULT_DESIGN_SYSTEM } from '../designSystem';
import { isRuntimeRecord, safeRecord, safeRecordArray } from '../utils/runtimeData';

export type SiteData = {
  settings: Record<string, any>;
  seo?: Record<string, any> | null;
  carousel: Record<string, any>[];
  sections: Record<string, any>[];
  landlordPlans: Record<string, any>[];
  propertyTypes: Record<string, any>[];
  areaUnits: Record<string, any>[];
  publicNavigation: Record<string, any>[];
  featuredProperties: Record<string, any>[];
  featuredSurveyors: Record<string, any>[];
  page?: Record<string, any> | null;
};

type SiteContextValue = { data: SiteData; loading: boolean; refresh: (path?: string) => Promise<void> };
const defaults: SiteData = {
  settings: { siteTitle: 'SecureAsset', shortTitle: 'SecureAsset', tagline: 'Property, tenancy and survey management in one secure platform.', brand: { primaryColor: '#0B5270', secondaryColor: '#0f172a', accentColor: '#22c55e', fontFamily: 'Open Sans' }, design: DEFAULT_DESIGN_SYSTEM, contact: {}, social: {}, seo: {}, footer: { description: 'A premium property operating system for rentals, tenancy, surveys and secure records.', navigation: [{ heading: 'Platform', links: [{ label: 'Marketplace', path: '/marketplace' }, { label: 'Pricing', path: '/pricing' }, { label: 'About SecureAsset', path: '/about' }] }, { heading: 'Operations', links: [{ label: 'Rent automation', path: '/pricing' }, { label: 'Document vault', path: '/login' }, { label: 'Surveyor marketplace', path: '/surveyors' }] }, { heading: 'Access', links: [{ label: 'Secure login', path: '/login' }, { label: 'Create account', path: '/login?mode=register' }, { label: 'Contact support', path: '/contact' }] }], legalLinks: [{ label: 'Privacy Policy', path: '/privacy-policy' }, { label: 'Terms of Service', path: '/terms-of-service' }, { label: 'Request a callback', path: '/callback' }], callback: { label: 'Request a callback', path: '/callback' } }, authentication: { badge: 'Enterprise property operations', headline: 'Every property workflow. One secure platform.', description: 'Manage properties, tenants, payments, surveys, legal records and communication with secure role-based access.', features: ['Role-based access','Encrypted document vault','Real-time messaging','Automated billing','Audit trails'], footerText: 'Enterprise property, tenancy and survey operations', loginSubtitle: 'Sign in using your email address or mobile number.', registerSubtitle: 'Create your account and verify your mobile number with OTP.', otpSubtitle: 'Use a secure one-time password sent to your registered mobile.', forgotSubtitle: 'The reset OTP is sent to your registered mobile.', allowRegistration: true, allowPasswordLogin: true, allowOtpLogin: true, showDemoAccounts: false } },
  carousel: [], sections: [], landlordPlans: [], propertyTypes: [], areaUnits: [], publicNavigation: [], featuredProperties: [], featuredSurveyors: [], seo: null, page: null,
};
const SiteContext = createContext<SiteContextValue>({ data: defaults, loading: true, refresh: async () => {} });
const CACHE_TTL_MS = 15_000;

function mergeSiteData(incoming: Partial<SiteData> = {}): SiteData {
  const source = safeRecord(incoming);
  const settings = safeRecord(source.settings);
  const listOrDefault = (value: unknown, fallback: Record<string, any>[]) => Array.isArray(value) ? safeRecordArray(value) : fallback;
  const objectOrDefault = (value: unknown, fallback: Record<string, any> | null) => value === null ? null : isRuntimeRecord(value) ? value : fallback;
  return {
    ...defaults,
    ...source,
    settings: {
      ...defaults.settings,
      ...settings,
      brand: { ...defaults.settings.brand, ...safeRecord(settings.brand) },
      contact: { ...defaults.settings.contact, ...safeRecord(settings.contact) },
      social: { ...defaults.settings.social, ...safeRecord(settings.social) },
      seo: { ...defaults.settings.seo, ...safeRecord(settings.seo) },
      footer: { ...defaults.settings.footer, ...safeRecord(settings.footer) },
      authentication: { ...defaults.settings.authentication, ...safeRecord(settings.authentication) },
      design: { ...defaults.settings.design, ...safeRecord(settings.design) },
    },
    carousel: listOrDefault(source.carousel, defaults.carousel),
    sections: listOrDefault(source.sections, defaults.sections),
    landlordPlans: listOrDefault(source.landlordPlans, defaults.landlordPlans),
    propertyTypes: listOrDefault(source.propertyTypes, defaults.propertyTypes),
    areaUnits: listOrDefault(source.areaUnits, defaults.areaUnits),
    publicNavigation: listOrDefault(source.publicNavigation, defaults.publicNavigation),
    featuredProperties: listOrDefault(source.featuredProperties, defaults.featuredProperties),
    featuredSurveyors: listOrDefault(source.featuredSurveyors, defaults.featuredSurveyors),
    seo: objectOrDefault(source.seo, defaults.seo || null),
    page: objectOrDefault(source.page, defaults.page || null),
  };
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const pathKey = (value: string) => String(value || '/').split('?')[0] || '/';
  const [currentPath, setCurrentPath] = useState(() => pathKey(window.location.pathname));
  const queryClient = useQueryClient();
  // TanStack Query owns the shared cache and inFlight request deduplication;
  // CACHE_TTL_MS keeps the previous freshness contract explicit.
  const fetchSiteConfig = useCallback(async (requestedPath: string) => {
    const response = await getSiteConfig(requestedPath);
    return mergeSiteData(response.data || {});
  }, []);
  const siteQuery = useQuery({
    queryKey: ['site-config', currentPath],
    queryFn: () => fetchSiteConfig(currentPath),
    placeholderData: (previous) => previous || defaults,
    staleTime: CACHE_TTL_MS,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const data = siteQuery.data || defaults;
  const loading = Boolean(siteQuery.isPending && siteQuery.isPlaceholderData);
  const refresh = useCallback(async (path = window.location.pathname) => {
    const requestedPath = pathKey(path);
    setCurrentPath(requestedPath);
    await queryClient.fetchQuery({
      queryKey: ['site-config', requestedPath],
      queryFn: () => fetchSiteConfig(requestedPath),
      staleTime: 0,
    });
  }, [fetchSiteConfig, queryClient]);
  useEffect(() => {
    const handle = () => { void refresh(window.location.pathname); };
    window.addEventListener('secureasset:site-changed', handle);
    return () => window.removeEventListener('secureasset:site-changed', handle);
  }, [refresh]);
  const value = useMemo(() => ({ data, loading, refresh }), [data, loading, refresh]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
export function useSite() { return useContext(SiteContext); }
