import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
  Link as EmailLink,
} from '@react-email/components';
import * as React from 'react';

interface EmailTemplateProps {
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  body: string;
  companyName?: string;
  logoUrl?: string;
}

export const EmailTemplate = ({
  fromName = 'Signal Noise',
  fromEmail = 'noreply@nakanodigital.com',
  subject = 'Email from Signal Noise',
  body,
  companyName = 'Signal Noise',
  logoUrl,
}: EmailTemplateProps) => {
  // Convert HTML body to plain text for preview
  const previewText = body.replace(/<[^>]*>/g, '').substring(0, 150);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 m-auto font-sans">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm my-8 mx-auto p-8 max-w-[600px]">
            {/* Header */}
            {logoUrl && (
              <Section className="mt-4 mb-6">
                <Img
                  src={logoUrl}
                  width="60"
                  height="60"
                  alt={companyName}
                  className="my-0 mx-auto"
                />
              </Section>
            )}

            {/* Subject/Title */}
            <Heading className="text-2xl text-gray-900 font-semibold text-center p-0 my-6 mx-0">
              {subject}
            </Heading>

            {/* Email Body */}
            <Section className="text-gray-700">
              <div
                dangerouslySetInnerHTML={{ __html: body }}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  color: '#374151',
                }}
              />
            </Section>

            {/* Footer */}
            <Section className="mt-8 pt-6 border-t border-gray-200">
              <Text className="text-sm text-gray-500 text-center m-0">
                Best regards,
                <br />
                <strong>{fromName}</strong>
                <br />
                <EmailLink
                  href={`mailto:${fromEmail}`}
                  className="text-blue-600 no-underline"
                >
                  {fromEmail}
                </EmailLink>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailTemplate;











