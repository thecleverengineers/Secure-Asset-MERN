import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  Box, Button, Card, CardContent, Chip, Grid, Stack, Typography,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import GroupRounded from '@mui/icons-material/GroupRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import ElectricMeterRounded from '@mui/icons-material/ElectricMeterRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import MessageRounded from '@mui/icons-material/MessageRounded';
import WebRounded from '@mui/icons-material/WebRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from '../../context/AuthContext';

type Feature = {
  label: string;
  path: string;
  description: string;
  workflow: string;
  icon: any;
};

type AdminModule = {
  title: string;
  eyebrow: string;
  description: string;
  features: Feature[];
};

const modules: Record<string, AdminModule> = {
  'people-access': {
    title: 'People & Access',
    eyebrow: 'Admin module',
    description: 'Manage platform users, tenant identities, occupants, interviews, roles and permission boundaries from one workspace.',
    features: [
      { label: 'Users', path: '/app/users', description: 'Search and manage platform accounts, roles and account status.', workflow: 'Account → Profile → Role / status → Manage', icon: PeopleRounded },
      { label: 'Tenant Profiles', path: '/app/tenant-profiles', description: 'Review tenant profile information linked to rental workflows.', workflow: 'Tenant → Profile → Review → Maintain', icon: PersonRounded },
      { label: 'Family & Occupants', path: '/app/occupants', description: 'Manage family and occupant records associated with tenants and tenancies.', workflow: 'Tenant → Occupants → Verify → Associate', icon: GroupRounded },
      { label: 'Tenant Interviews', path: '/app/tenant-interviews', description: 'Track tenant interview scheduling and recorded outcomes.', workflow: 'Request → Schedule → Interview → Result', icon: CalendarMonthRounded },
      { label: 'Role & Permissions', path: '/app/role-permissions', description: 'Control role-level capabilities without changing existing route security.', workflow: 'Role → Permissions → Save → Enforce', icon: AdminPanelSettingsRounded },
    ],
  },
  'property-tenancy': {
    title: 'Property & Tenancy',
    eyebrow: 'Admin module',
    description: 'Follow the complete property-to-occupancy lifecycle without spreading operational records across the sidebar.',
    features: [
      { label: 'Properties', path: '/app/properties', description: 'Review and manage property records across the platform.', workflow: 'Property → Review → Manage → Status', icon: ApartmentRounded },
      { label: 'Applications', path: '/app/applications', description: 'Review rental applications and their supporting workflow.', workflow: 'Application → Review → Decision → Agreement', icon: FactCheckRounded },
      { label: 'Property Site Visits', path: '/app/property-visits', description: 'Track requested and scheduled site visits.', workflow: 'Request → Schedule → Visit → Complete', icon: CalendarMonthRounded },
      { label: 'Active Tenancies', path: '/app/tenancies', description: 'Monitor tenant, unit, agreement and tenancy status.', workflow: 'Agreement → Start tenancy → Operate → End / renew', icon: HomeWorkRounded },
      { label: 'Lease Management', path: '/app/leases', description: 'Manage lease records, dates, signatures and lifecycle status.', workflow: 'Create → Sign → Active → Renew / end', icon: DescriptionRounded },
      { label: 'Complaints & Maintenance', path: '/app/complaints', description: 'Track tenant issues, maintenance requests and resolution status.', workflow: 'Issue → Review → Action → Resolve', icon: BuildRounded },
      { label: 'Facilities', path: '/app/facilities', description: 'Maintain property facility definitions and availability.', workflow: 'Facility → Configure → Publish → Maintain', icon: AccountBalanceRounded },
      { label: 'Facility Bookings', path: '/app/facility-bookings', description: 'Review and manage facility reservation records.', workflow: 'Request → Book → Use → Complete / cancel', icon: CalendarMonthRounded },
    ],
  },
  'finance-billing': {
    title: 'Finance & Billing',
    eyebrow: 'Admin module',
    description: 'Centralize rent cycles, invoices, payment tracking, utilities and reminder operations while retaining current finance routes.',
    features: [
      { label: 'Rent & Bills', path: '/app/rental-invoices', description: 'Monitor tenancy billing cycles, balances and invoice status.', workflow: 'Rent cycle → Invoice → Due → Paid / overdue', icon: ReceiptLongRounded },
      { label: 'Payments & Invoices', path: '/app/payments', description: 'Review payment and invoice records across operational workflows.', workflow: 'Payment → Evidence → Verify → Settle', icon: PaymentsRounded },
      { label: 'Meter Readings', path: '/app/utility-readings', description: 'Track unit utility readings used in tenancy billing.', workflow: 'Read meter → Record → Calculate → Bill', icon: ElectricMeterRounded },
      { label: 'Payment Reminders', path: '/app/reminder-rules', description: 'Manage reminder rules used for unpaid rental cycles.', workflow: 'Invoice due → Reminder rule → Send → Stop when paid', icon: NotificationsRounded },
    ],
  },
  'survey-operations': {
    title: 'Survey Operations',
    eyebrow: 'Admin module',
    description: 'Manage the complete survey ecosystem from surveyor setup and quotations through active projects, reports and disputes.',
    features: [
      { label: 'Surveys', path: '/app/surveys', description: 'Review survey records and operational status.', workflow: 'Request → Assign → Verify → Complete', icon: AssignmentRounded },
      { label: 'Surveyor Plans', path: '/app/surveyor-plans', description: 'Manage surveyor plan definitions and related records.', workflow: 'Plan → Configure → Subscribe → Maintain', icon: WorkspacePremiumRounded },
      { label: 'Surveyor Profiles', path: '/app/surveyor-profiles', description: 'Review professional surveyor profile records.', workflow: 'Profile → Compliance → Verify → Publish', icon: PersonRounded },
      { label: 'Survey Services', path: '/app/survey-services', description: 'Manage services offered through the survey workflow.', workflow: 'Service → Configure → Offer → Maintain', icon: StorefrontRounded },
      { label: 'Survey Quotes', path: '/app/survey-jobs', description: 'Track landlord survey quote requests.', workflow: 'Request → Quote → Review → Accept', icon: RequestQuoteRounded },
      { label: 'Proposals', path: '/app/survey-quotations', description: 'Track surveyor proposals and their decision state.', workflow: 'Proposal → Review → Accept → Project', icon: RequestQuoteRounded },
      { label: 'Active Projects', path: '/app/survey-projects', description: 'Open field workflows, evidence, reporting and project progress.', workflow: 'Project → Field work → Evidence → Report → Complete', icon: BusinessCenterRounded },
      { label: 'Survey Reports', path: '/app/survey-reports', description: 'Review final and in-progress survey report records.', workflow: 'Draft → Submit → Review → Finalize', icon: DescriptionRounded },
      { label: 'Disputes', path: '/app/survey-disputes', description: 'Manage survey-related disputes and resolution records.', workflow: 'Dispute → Evidence → Review → Resolve', icon: BuildRounded },
      { label: 'Promotions', path: '/app/survey-promotions', description: 'Manage survey promotion records and status.', workflow: 'Promotion → Review → Activate → Expire', icon: CampaignRounded },
    ],
  },
  'documents-drive': {
    title: 'Documents & Drive',
    eyebrow: 'Admin module',
    description: 'Bring secure document access, storage governance and public-file compliance into one administrative workspace.',
    features: [
      { label: 'Document Vault', path: '/app/documents', description: 'Access protected documents and existing vault workflows.', workflow: 'Store → Protect → Access → Audit', icon: FolderRounded },
      { label: 'Drive Administration', path: '/app/drive-admin', description: 'Manage storage policy, public sharing, usage and reported content.', workflow: 'Store → Share → Monitor → Restrict / retain', icon: AdminPanelSettingsRounded },
    ],
  },
  communication: {
    title: 'Communication',
    eyebrow: 'Admin module',
    description: 'Centralize platform notifications, direct messaging and public website enquiries.',
    features: [
      { label: 'Notifications', path: '/app/notifications', description: 'Review workflow-generated notifications and unread status.', workflow: 'Event → Notification → Deliver → Read', icon: NotificationsRounded },
      { label: 'Messages', path: '/app/messages', description: 'Open the existing messaging workspace and conversations.', workflow: 'Conversation → Message → Reply → History', icon: MessageRounded },
      { label: 'Website Enquiries', path: '/app/site-enquiries', description: 'Review enquiries received from the public website.', workflow: 'Enquiry → Review → Respond → Close', icon: MessageRounded },
    ],
  },
  'reports-analytics': {
    title: 'Reports & Analytics',
    eyebrow: 'Admin module',
    description: 'Use the existing reporting workspace as the single analytics entry point for platform operations.',
    features: [
      { label: 'Reports & Analytics', path: '/app/reports', description: 'Analyze operational, user, property, tenancy, finance and survey information.', workflow: 'Data → Filter → Analyze → Export / act', icon: AssessmentRounded },
    ],
  },
  'platform-administration': {
    title: 'Platform Administration',
    eyebrow: 'Admin module',
    description: 'Control branding, visual design and system configuration without exposing every administrative tool as a separate sidebar item.',
    features: [
      { label: 'Site, Design & Homepage', path: '/app/site-admin', description: 'Manage site identity, homepage, footer/legal content and platform presentation.', workflow: 'Configure → Preview → Publish → Refresh', icon: WebRounded },
      { label: 'Design Studio', path: '/app/design-studio', description: 'Open the visual application design and navigation workspace.', workflow: 'Design → Configure → Validate → Publish', icon: PaletteRounded },
      { label: 'System Settings', path: '/app/settings', description: 'Manage current platform settings and supported integration configuration.', workflow: 'Settings → Validate → Save → Apply', icon: SettingsRounded },
    ],
  },
};

export default function AdminModuleHubPage() {
  const { user } = useAuth();
  const { moduleKey = '' } = useParams();
  const navigate = useNavigate();
  const module = useMemo(() => modules[moduleKey], [moduleKey]);

  if (user?.role !== 'admin') return <Navigate replace to="/access-denied" />;
  if (!module) return <Navigate replace to="/app/dashboard" />;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 3, lg: 4 }, pb: 6 }}>
      <PageHeader
        variant="plain"
        eyebrow={module.eyebrow}
        title={module.title}
        description={module.description}
        meta={<Chip size="small" label={`${module.features.length} connected workflows`} />}
      />

      <Grid container spacing={1.5}>
        {module.features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Grid key={feature.path} size={{ xs: 12, sm: 6, xl: 4 }}>
              <Card
                elevation={0}
                variant="outlined"
                onClick={() => navigate(feature.path)}
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  borderRadius: 3,
                  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 14px 34px rgba(15,23,42,.08)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
                    <Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'action.hover', color: 'primary.main', flexShrink: 0 }}>
                      <Icon />
                    </Box>
                    <Button size="small" endIcon={<ArrowForwardRounded />} onClick={(event) => { event.stopPropagation(); navigate(feature.path); }}>
                      Open
                    </Button>
                  </Stack>
                  <Typography sx={{ mt: 1.6, fontSize: 16, fontWeight: 700 }}>{feature.label}</Typography>
                  <Typography color="text.secondary" sx={{ mt: .55, fontSize: 12.5, lineHeight: 1.6 }}>{feature.description}</Typography>
                  <Box sx={{ mt: 1.5, pt: 1.3, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: 10.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Workflow</Typography>
                    <Typography sx={{ mt: .35, fontSize: 11.8 }}>{feature.workflow}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
