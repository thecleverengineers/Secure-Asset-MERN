import { Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { useLocation } from 'react-router';

type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
type LegalPage = { title: string; summary: string; sections: LegalSection[] };

const policies: Record<string, LegalPage> = {
  '/terms-and-conditions': {
    title: 'Terms and Conditions',
    summary: 'These terms explain the rules for using SecureAsset, its property marketplace, landlord and tenant tools, survey services, subscriptions, and document features.',
    sections: [
      { heading: '1. About these terms', paragraphs: ['These Terms and Conditions apply when you visit secureasset.in or use a SecureAsset account, application, or service. By using the platform, you agree to these terms and any plan or feature terms shown to you at the time you use or purchase that feature.', 'If you do not agree, do not create an account or use the relevant service. Additional terms shown during checkout, a booking, or a separate agreement apply to that specific transaction.'] },
      { heading: '2. What SecureAsset provides', paragraphs: ['SecureAsset provides digital tools for property discovery and listing, rental applications and tenancy administration, survey workflows, subscriptions, communications, and secure document management.', 'Unless a page or checkout clearly identifies SecureAsset as the provider or recipient of a particular service or payment, property listings and property, rental, or survey services are offered by the relevant landlord, tenant, surveyor, or other user. SecureAsset is not the owner of every listed property and is not a party to agreements between users simply because those agreements are recorded or signed through the platform.'] },
      { heading: '3. Accounts and accurate information', paragraphs: ['You must provide information that is accurate, current, and complete, keep your sign-in details secure, and promptly update information that changes. You are responsible for activity through your account and for using account features only for their intended purpose.', 'Some features may require identity, property, professional, or payment checks. You agree to provide only information and documents that you are authorised to provide. SecureAsset may review information or restrict a feature while a check or safety review is pending.'] },
      { heading: '4. Listings, checks, and user content', paragraphs: ['Users are responsible for the accuracy and legality of their listings, messages, documents, photographs, reports, and other content. Before applying for or accepting a property, users should independently confirm ownership or authority to let, property condition, availability, charges, and any legal requirements that matter to them.', 'A verification, approval, or profile status describes the checks recorded by SecureAsset for that specific workflow. It is not a guarantee of title, condition, safety, future availability, legal compliance, or a particular survey outcome. Do not rely on a platform label as a substitute for your own checks or professional advice.', 'You retain your rights in content you provide. You give SecureAsset permission to host, process, display, and share that content as needed to operate the features you choose, follow your sharing settings, and meet legal or security obligations. You must not upload content that you do not have the right to use or disclose.'] },
      { heading: '5. Applications, tenancies, rent, and surveys', paragraphs: ['Rental terms, deposits, rent, handover, cancellation, and other obligations should be set out in the agreement between the relevant landlord and tenant. Survey scope, price, timing, and report delivery should be agreed between the client and surveyor. SecureAsset workflow tools help users manage these processes but do not replace their agreements or legal obligations.', 'Users must not misrepresent a property, applicant, surveyor qualification, payment, or supporting document. Contact SecureAsset if you believe a listing, account, or document is fraudulent or unsafe.'] },
      { heading: '6. Plans, fees, and payments', paragraphs: ['Plan features, prices, billing period, taxes, and any renewal terms are shown in the applicable plan or checkout before payment. Payment processing may be handled by a third-party payment provider. Do not share your password, payment PIN, card security code, or one-time password with SecureAsset or another user.', 'Subscription cancellation and refund requests are covered by the Cancellation and Refunds page. Rent, security deposits, booking amounts, or service fees paid directly to another user or provider are governed by the agreement with that recipient and applicable law.'] },
      { heading: '7. Acceptable use and account action', paragraphs: ['You may not use SecureAsset to break the law, deceive another user, interfere with the service, access another person’s account or documents without permission, distribute harmful code, or misuse personal information. You must respect the access controls and document-sharing permissions provided by the platform.', 'SecureAsset may limit or suspend access when reasonably needed to protect users, investigate suspected misuse, meet legal requirements, or maintain the service. Where practical, we will explain the reason and how to contact us about the decision.'] },
      { heading: '8. Availability and responsibility', paragraphs: ['We work to keep SecureAsset available and accurate, but online services can be interrupted and information can change. Features may be updated, paused, or discontinued. We do not promise uninterrupted access or that every user-provided listing or document is complete or current.', 'To the extent permitted by law, SecureAsset is not responsible for indirect loss arising from use of the platform or from a transaction between users. Nothing in these terms removes a right or liability that cannot lawfully be excluded.'] },
      { heading: '9. Governing law and contact', paragraphs: ['These terms are governed by the laws of India. Any dispute is subject to the courts that have jurisdiction under applicable law. If a court finds part of these terms unenforceable, the remaining terms continue to apply to the extent permitted by law.', 'For questions, complaints, or requests about these terms, contact SecureAsset using the details below.'] },
    ],
  },
  '/privacy-policy': {
    title: 'Privacy Policy',
    summary: 'This policy describes how SecureAsset handles personal information when you visit secureasset.in or use the platform.',
    sections: [
      { heading: '1. Who this policy covers', paragraphs: ['This Privacy Policy applies to SecureAsset websites, accounts, and features, including property listings, rental applications and tenancy records, survey workflows, subscriptions, messages, and the Document Vault. It should be read with any privacy notice shown when you submit information for a particular feature.'] },
      { heading: '2. Information we may handle', paragraphs: ['Depending on the features you use, information may include:'], bullets: ['Account and contact details such as your name, email address, phone number, and profile information.', 'Identity or verification documents and review results that you choose or are required to submit for KYC, landlord, tenant, or surveyor workflows.', 'Property listing details, rental applications, tenancy and payment records, survey information, photos, reports, agreements, and documents you upload or receive.', 'Messages, support requests, and details you provide through a contact or enquiry form.', 'Basic device, log, and usage information used to operate the site, protect accounts, diagnose errors, and prevent misuse.'] },
      { heading: '3. Why we use information', paragraphs: ['We use information to create and secure accounts; provide requested marketplace and workflow features; review verification submissions; connect users for applications, tenancies, and surveys; process subscriptions or route payment records; send service notices; answer support requests; maintain platform safety; improve reliability; and meet legal obligations.', 'Where consent is the basis for a use, you can contact us to withdraw it. Withdrawal does not affect processing already carried out or processing that is otherwise permitted or required by law.'] },
      { heading: '4. How information may be shared', paragraphs: ['We share information only as needed to provide a feature, follow your choices, protect the service, or meet legal requirements. Depending on your workflow, this may include sharing an application with the relevant landlord, tenancy details with the relevant tenant or landlord, or survey information with the client and surveyor involved.', 'SecureAsset may use service providers for hosting, payment processing, communications, storage, security, and support. They receive information needed for their service. We may also disclose information when required by law or when reasonably necessary to address fraud, safety, or security concerns.', 'A public listing or profile can expose the details you choose to make public. Please avoid including sensitive personal information in public fields.'] },
      { heading: '5. Document Vault and account security', paragraphs: ['Documents and verification records are handled according to the feature’s access controls and the sharing choices made by the account holder. Use care when sharing a document or access link, and remove access when it is no longer needed. SecureAsset uses administrative and technical safeguards intended to protect information, but no online system can be guaranteed completely secure.'] },
      { heading: '6. Cookies and technical information', paragraphs: ['The site may use essential cookies or local storage to keep you signed in, remember preferences, protect sessions, and support core features. Browser settings can control cookies, although disabling essential storage may affect site functionality.'] },
      { heading: '7. Retention and your choices', paragraphs: ['We keep information for as long as reasonably needed to provide the service, maintain account and transaction records, resolve disputes, protect users, and meet legal requirements. Retention can vary by record type and feature.', 'You may contact us to request access to, correction of, or deletion of your personal information, or to ask a question or make a complaint. We will assess requests under applicable law and may need to retain some records for security, contractual, or legal reasons.'] },
      { heading: '8. Changes and contact', paragraphs: ['We may update this policy as SecureAsset changes. The current version will appear on this page with its latest update date. For privacy questions, requests, or complaints, contact SecureAsset using the details below.'] },
    ],
  },
  '/shipping-policy': {
    title: 'Shipping Policy',
    summary: 'SecureAsset is a digital property platform. We do not ship physical products.',
    sections: [
      { heading: '1. Digital services', paragraphs: ['SecureAsset does not sell or deliver physical goods, so no courier, parcel tracking, or physical shipping fee applies to platform access.', 'When you purchase a subscription or digital service through SecureAsset, access is provided online through secureasset.in or your account after payment confirmation and any required account or eligibility checks. The plan page or checkout shows the applicable features and term.'] },
      { heading: '2. Documents and digital records', paragraphs: ['Agreements, invoices, receipts, survey reports, and other digital records are made available through the relevant account workflow when they are created or uploaded. Availability may depend on the other participant completing their part of the workflow.', 'If a payment is confirmed but an included digital feature is not available, contact SecureAsset with your account email and payment reference so we can investigate.'] },
      { heading: '3. Property and in-person services', paragraphs: ['Property viewings, inspections, survey visits, keys, and other in-person arrangements are coordinated with the relevant landlord, tenant, surveyor, or service provider. The parties should confirm the location, schedule, and any travel or service charges directly in their agreement.', 'SecureAsset does not arrange courier delivery of property items unless a specific feature expressly says otherwise.'] },
      { heading: '4. Contact', paragraphs: ['For questions about access to a paid digital service or record, contact SecureAsset using the details below.'] },
    ],
  },
  '/cancellation-and-refunds': {
    title: 'Cancellation and Refunds',
    summary: 'This policy explains how to cancel a SecureAsset plan and how requests for refunds are reviewed.',
    sections: [
      { heading: '1. Cancelling a plan', paragraphs: ['Plan prices, terms, and renewal settings are shown before purchase. If recurring renewal is enabled for your plan, use the account or payment-provider controls shown for that plan to stop a future renewal. You can also request help at secureasset9@gmail.com.', 'Unless the checkout or plan terms say otherwise, cancellation stops future renewal and does not automatically refund a period that has already started. Access to paid features generally remains available through the paid period, subject to the plan terms and any account or safety restrictions.'] },
      { heading: '2. When to request a refund', paragraphs: ['Contact SecureAsset promptly if you believe you were charged twice, a payment succeeded but the paid plan was not activated, a payment was not authorised by you, or a paid digital service was not supplied as described. We will review the transaction and the relevant plan or service terms.', 'Where a refund is approved or required by applicable law, it will normally be sent back through the original payment method. Your bank or payment provider controls the final time for the funds to appear.'] },
      { heading: '3. Requests that may not qualify', paragraphs: ['Except where applicable law or the displayed plan terms require otherwise, unused time after a paid period begins, a change of mind, failure to use a feature, or a restriction caused by misuse of the service will not by itself qualify for a refund.', 'Rent, security deposits, booking amounts, or service fees paid directly to a landlord, tenant, surveyor, or other provider are not payments received by SecureAsset. Ask the recipient under your agreement with them. If a transaction was processed through a SecureAsset checkout, contact us and we will review the payment route and applicable terms.'] },
      { heading: '4. How to submit a request', paragraphs: ['Email secureasset9@gmail.com or call +91 60093 45739. Include your SecureAsset account email, payment date and amount, transaction or order reference, plan or service, and a short explanation. Do not send a password, card PIN, CVV, or one-time password.', 'We will review the details and contact you if we need more information. Any approved refund is sent to the original payment method, and bank or payment-provider processing times may vary. This policy does not limit rights that cannot legally be excluded.'] },
      { heading: '5. Contact', paragraphs: ['For cancellation assistance or a refund request, contact SecureAsset using the details below.'] },
    ],
  },
};

export default function LegalPolicyPage() {
  const location = useLocation();
  const page = policies[location.pathname] || policies['/terms-and-conditions'];

  return (
    <Box sx={{ minHeight: '100%', bgcolor: '#f7fafc', color: '#0b2057', fontFamily: '"Open Sans", sans-serif' }}>
      <Box sx={{ py: { xs: 5, md: 7 }, background: 'radial-gradient(circle at 90% 10%, rgba(0,143,131,.11), transparent 22rem), linear-gradient(180deg,#f5f9fd 0%,#ffffff 100%)', borderBottom: '1px solid #e4edf5' }}>
        <Container maxWidth="md">
          <Chip label="SECUREASSET · POLICIES" sx={{ mb: 2, height: 28, borderRadius: 2, bgcolor: '#eaf8f6', color: '#087f76', fontSize: 10, fontWeight: 700, letterSpacing: '.08em' }} />
          <Typography component="h1" sx={{ color: '#0b2057', fontSize: { xs: 31, md: 42 }, fontWeight: 650, letterSpacing: '-.045em', lineHeight: 1.12 }}>{page.title}</Typography>
          <Typography sx={{ mt: 1.7, maxWidth: 760, color: '#60708a', fontSize: { xs: 14, md: 15 }, lineHeight: 1.8 }}>{page.summary}</Typography>
          <Typography sx={{ mt: 2, color: '#8291a5', fontSize: 11 }}>Last updated: 25 September 2026</Typography>
        </Container>
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2}>
          {page.sections.map((section, index) => (
            <Paper component="section" elevation={0} key={section.heading} sx={{ p: { xs: 2.2, sm: 3 }, border: '1px solid #e2eaf1', borderRadius: 3, bgcolor: '#fff', boxShadow: '0 6px 20px rgba(17,58,93,.035)' }}>
              <Typography component="h2" sx={{ color: '#153553', fontSize: { xs: 16, sm: 18 }, fontWeight: 650, letterSpacing: '-.02em' }}>{section.heading}</Typography>
              <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                {section.paragraphs.map((paragraph) => <Typography key={paragraph} component="p" sx={{ m: 0, color: '#60708a', fontSize: 13, lineHeight: 1.85 }}>{paragraph}</Typography>)}
                {section.bullets && <Box component="ul" sx={{ mt: 0, mb: 0, pl: 2.5, color: '#60708a', '& li': { pl: .5, mb: .75, fontSize: 13, lineHeight: 1.8 }, '& li:last-child': { mb: 0 } }}>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </Box>}
              </Stack>
            </Paper>
          ))}
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, mt: 1, border: '1px solid #d8e9ea', borderRadius: 3, bgcolor: '#f1f9f8' }}>
            <Typography sx={{ color: '#153553', fontSize: 17, fontWeight: 650 }}>Contact SecureAsset</Typography>
            <Typography sx={{ mt: .7, color: '#60708a', fontSize: 13, lineHeight: 1.75 }}>For support, privacy requests, complaints, or questions about this page:</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
              <Button component="a" href="mailto:secureasset9@gmail.com" variant="outlined" sx={{ borderColor: '#c8dcdf', color: '#0b5270', textTransform: 'none', fontWeight: 650, justifyContent: 'flex-start' }}>secureasset9@gmail.com</Button>
              <Button component="a" href="tel:+916009345739" variant="outlined" sx={{ borderColor: '#c8dcdf', color: '#0b5270', textTransform: 'none', fontWeight: 650, justifyContent: 'flex-start' }}>+91 60093 45739</Button>
              <Button component="a" href="https://secureasset.in" target="_blank" rel="noreferrer" variant="outlined" sx={{ borderColor: '#c8dcdf', color: '#0b5270', textTransform: 'none', fontWeight: 650, justifyContent: 'flex-start' }}>secureasset.in</Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
