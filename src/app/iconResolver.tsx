import type { ElementType } from 'react';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import CollectionsRounded from '@mui/icons-material/CollectionsRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import ElectricMeterRounded from '@mui/icons-material/ElectricMeterRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import GroupWorkRounded from '@mui/icons-material/GroupWorkRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import MessageRounded from '@mui/icons-material/MessageRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import WebRounded from '@mui/icons-material/WebRounded';
import WorkHistoryRounded from '@mui/icons-material/WorkHistoryRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';

/**
 * The navigation shell only needs a small, stable icon set. Keeping this
 * resolver separate from the admin icon catalogue prevents every signed-in
 * page from downloading every MUI icon just to render a sidebar.
 */
const iconMap: Record<string, ElementType> = {
  accountbalance: AccountBalanceRounded,
  add: AddRounded,
  adminpanelsettings: AdminPanelSettingsRounded,
  analytics: AnalyticsRounded,
  apartment: ApartmentRounded,
  approval: ApprovalRounded,
  assessment: AssessmentRounded,
  assignment: AssignmentRounded,
  badge: BadgeRounded,
  build: BuildRounded,
  businesscenter: BusinessCenterRounded,
  calendarmonth: CalendarMonthRounded,
  campaign: CampaignRounded,
  collections: CollectionsRounded,
  dashboard: DashboardRounded,
  description: DescriptionRounded,
  electricmeter: ElectricMeterRounded,
  engineering: EngineeringRounded,
  explore: ExploreRounded,
  factcheck: FactCheckRounded,
  folder: FolderRounded,
  groupwork: GroupWorkRounded,
  history: HistoryRounded,
  home: HomeRounded,
  homework: HomeWorkRounded,
  meetingroom: MeetingRoomRounded,
  message: MessageRounded,
  notifications: NotificationsRounded,
  payments: PaymentsRounded,
  people: PeopleRounded,
  person: PersonRounded,
  receiptlong: ReceiptLongRounded,
  requestquote: RequestQuoteRounded,
  search: SearchRounded,
  security: SecurityRounded,
  settings: SettingsRounded,
  storefront: StorefrontRounded,
  straighten: StraightenRounded,
  verifieduser: VerifiedUserRounded,
  web: WebRounded,
  workhistory: WorkHistoryRounded,
  workspacepremium: WorkspacePremiumRounded,
};

const normalise = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function resolveIconComponent(name?: string): ElementType {
  return iconMap[normalise(name)] || DashboardRounded;
}
