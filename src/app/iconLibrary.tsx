import type { ElementType } from 'react';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import CollectionsRounded from '@mui/icons-material/CollectionsRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import ElectricMeterRounded from '@mui/icons-material/ElectricMeterRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import GroupWorkRounded from '@mui/icons-material/GroupWorkRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MessageRounded from '@mui/icons-material/MessageRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import SplitscreenRounded from '@mui/icons-material/SplitscreenRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import WebRounded from '@mui/icons-material/WebRounded';
import WorkHistoryRounded from '@mui/icons-material/WorkHistoryRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';

/**
 * The design studio is an admin-only route. Keep its icon catalogue explicit
 * so opening the normal application shell does not import the entire MUI icon
 * namespace. Unknown names stored by an older release safely use Dashboard.
 */
export type IconTone = 'monochrome' | 'colorful';
export type IconStyle = 'outline' | 'filled' | 'rounded' | 'sharp' | 'two-tone';
export type IconCatalogEntry = { name: string; label: string; style: IconStyle; tone: IconTone; keywords: string[] };

const iconMap: Record<string, ElementType> = {
  AccountBalanceRounded, AddRounded, AdminPanelSettingsRounded, AnalyticsRounded, ApartmentRounded,
  ApprovalRounded, AssessmentRounded, AssignmentRounded, ArrowDownwardRounded, ArrowUpwardRounded,
  BadgeRounded, BuildRounded, BusinessCenterRounded, CalendarMonthRounded, CampaignRounded,
  CollectionsRounded, ContentCopyRounded, DashboardRounded, DeleteRounded, DescriptionRounded,
  DoneAllRounded, DragIndicatorRounded, EditRounded, ElectricMeterRounded, EngineeringRounded,
  ExploreRounded, FactCheckRounded, FolderRounded, GridViewRounded, GroupWorkRounded, HomeRounded,
  HomeWorkRounded, InsertDriveFileRounded, LockRounded, MessageRounded, NotificationsRounded,
  PaletteRounded, PaymentsRounded, PeopleRounded, PersonRounded, ReceiptLongRounded, RequestQuoteRounded,
  RestartAltRounded, SearchRounded, SecurityRounded, SettingsRounded, SplitscreenRounded,
  StorefrontRounded, StraightenRounded, TuneRounded, VerifiedUserRounded, VisibilityOffRounded,
  VisibilityRounded, WebRounded, WorkHistoryRounded, WorkspacePremiumRounded,
};

const styleFor = (name: string): IconStyle => name.endsWith('Outlined') ? 'outline' : name.endsWith('Rounded') ? 'rounded' : name.endsWith('Sharp') ? 'sharp' : name.endsWith('TwoTone') ? 'two-tone' : 'filled';
const labelFor = (name: string) => name.replace(/(Outlined|Rounded|Sharp|TwoTone)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
const normalised = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const ICON_CATALOG: IconCatalogEntry[] = Object.keys(iconMap).map((name) => {
  const label = labelFor(name);
  return { name, label, style: styleFor(name), tone: name.includes('Color') ? 'colorful' : 'monochrome', keywords: label.toLowerCase().split(/\s+/) };
});

const aliases = new Map<string, string>();
ICON_CATALOG.forEach((entry) => {
  aliases.set(normalised(entry.name), entry.name);
  aliases.set(normalised(entry.label), entry.name);
});

export function resolveIconComponent(name?: string): ElementType {
  const key = name ? aliases.get(normalised(name)) || name : 'DashboardRounded';
  return iconMap[key] || DashboardRounded;
}

export function searchIcons(query = '', style?: IconStyle, tone?: IconTone, limit = 160) {
  const needle = query.trim().toLowerCase();
  return ICON_CATALOG
    .filter((entry) => (!style || entry.style === style) && (!tone || entry.tone === tone))
    .filter((entry) => !needle || entry.label.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle) || entry.keywords.some((keyword) => keyword.includes(needle)))
    .slice(0, limit);
}

export const ICON_LIBRARY_SIZE = ICON_CATALOG.length;
