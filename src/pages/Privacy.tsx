// /privacy — in the app: the short version, what an OHRR account keeps (update
// 31), and a link to the full policy on the website (ohrr-website /privacy,
// which covers the website and the app together). Draft, like the full policy,
// until the OHRR board has read it. Keep every claim true to the code:
//   - account: Supabase Auth (email + hashed password), user_profiles (name),
//     user_saves (follows, sessions, My Bunny without photos, "last looked"),
//     My Bunny photos in the private my-bunny-photos bucket (update 32, own
//     folder only), mailing_list (email choices) — readable only by the
//     person; staff with supporters.view (and founders / developers) read the
//     email list only;
//   - notifications (update 32): push_subscriptions — the browser's push
//     endpoint + keys and the topics, with or without an account; removed when
//     turned off;
//   - delete: My OHRR → Delete my account → the photos folder, then
//     delete_own_account();
//   - bookings, added events and phone reminders stay on the phone;
//   - visits: Cloudflare Web Analytics (cookie-free), switched on by OHRR
//     2026-09-26.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageHeader, Screen } from '../components/ui'
import { Icon } from '../components/icons'

const UPDATED = 'Sep 26, 2026'
const FULL_POLICY = 'https://ohrr-website.pages.dev/privacy'

function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 font-display text-lg font-extrabold text-ink">{children}</h2>
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-slate-700">{children}</p>
}
function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">{children}</ul>
}

export default function Privacy() {
  return (
    <>
      <PageHeader icon="info" title="Privacy" subtitle="How the OHRR app handles your information — in plain English." />
      <Screen className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Draft — pending OHRR board review · Last updated {UPDATED}
        </p>

        <P>
          <strong>The short version:</strong> you can use the app without an account. We do not sell personal
          information, and there are no advertising networks or tracking cookies. To count visits we use Cloudflare
          Web Analytics, which uses no cookies and doesn't identify you. If you make an account, it keeps what you save
          so it's there on any phone you sign in on — and only you can see it.
        </P>

        <H>Your OHRR account</H>
        <P>An account is optional. If you make one, it keeps:</P>
        <UL>
          <li>
            <strong>Your name and email.</strong> The email is how you sign in; your password is stored by our sign-in
            provider (Supabase) in protected, scrambled form — nobody at OHRR can see it.
          </li>
          <li>
            <strong>What you save:</strong> your favourite rabbits, the BunFest sessions you save, and My Bunny,
            with its photos — kept in a private folder only you can reach. Backup in My Bunny still makes a copy you
            keep yourself.
          </li>
          <li>
            <strong>Your email choices:</strong> what you'd like OHRR to email you about, and whether you want emails
            at all. Every email has a link to change this or stop.
          </li>
        </UL>
        <P>
          <strong>Notifications on your phone</strong> (My OHRR, with or without an account): if you turn them on, the
          app keeps your phone's notification address — made by your phone's browser, not your number — and what you
          ticked, so OHRR can send them. Turning them off removes it.
        </P>
        <P>
          Only you can see what your account keeps. OHRR staff can see only the email list — the names, email
          addresses and choices of people who asked for emails — never your favourites, sessions or My Bunny.
        </P>
        <P>
          <strong>Deleting your account:</strong> My OHRR → <strong>Delete my account</strong>. It removes your
          sign-in, your name, what your account saved and the email choices you made in it, straight away. What's on
          your phone stays on your phone until you delete it or the app. If you joined the email list without signing
          in, every email has a link to leave it — or email us and we'll remove you.
        </P>

        <H>Kept only on your phone</H>
        <UL>
          <li>Bookings you make, with their private cancel link, and events you add to your calendar.</li>
          <li>
            Reminders. "Remind me on this phone" and My Bunny's care reminders are scheduled by your phone itself —
            nothing about them is sent to us.
          </li>
          <li>Without an account: your favourites, saved sessions and My Bunny, photos and all.</li>
        </UL>

        <H>Everything else</H>
        <P>
          Forms, bookings, raffle tickets, how long we keep things, and how to ask us what we hold about you are all in
          the full privacy policy, which covers the OHRR website and this app together.
        </P>
        <a
          href={FULL_POLICY}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue"
        >
          Read the full privacy policy <Icon name="external" size={12} />
        </a>
        <p className="text-sm text-slate-500">
          <Link to="/account" className="font-semibold text-brand-blue">
            My OHRR
          </Link>{' '}
          ·{' '}
          <Link to="/settings" className="font-semibold text-brand-blue">
            Settings
          </Link>
        </p>
      </Screen>
    </>
  )
}
