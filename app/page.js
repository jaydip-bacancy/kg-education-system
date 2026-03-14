export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f3ef] text-[#1e1b19]">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 -left-28 h-80 w-80 rounded-full bg-[#ffd9b8]/70 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#c6e7ff]/70 blur-3xl" />
        <div className="absolute top-20 right-1/4 h-40 w-40 rounded-full bg-[#ffe9f0]/70 blur-3xl" />

        <header className="relative z-10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] text-white">
                bw
              </div>
              <div className="text-lg font-semibold tracking-tight">
                brightsteps
              </div>
            </div>
            <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
              <a className="text-[#1e1b19]/70 hover:text-[#1e1b19]" href="#why">
                Why us
              </a>
              <a
                className="text-[#1e1b19]/70 hover:text-[#1e1b19]"
                href="#features"
              >
                Features
              </a>
              <a
                className="text-[#1e1b19]/70 hover:text-[#1e1b19]"
                href="#stories"
              >
                Stories
              </a>
              <a className="text-[#1e1b19]/70 hover:text-[#1e1b19]" href="#faq">
                FAQ
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="hidden rounded-[var(--radius)] border border-[#1e1b19]/20 px-4 py-2 text-sm font-medium text-[#1e1b19] transition hover:border-[#1e1b19]/40 hover:bg-white md:inline-flex"
              >
                Log in
              </a>
              <a
                href="/register"
                className="inline-flex items-center rounded-[var(--radius)] bg-[#1e1b19] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:translate-y-[-1px] hover:bg-black"
              >
                Get started
              </a>
            </div>
          </div>
        </header>

        <section className="relative z-10">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center rounded-[var(--radius)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d] shadow-sm">
                Childcare platform
              </div>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[#1e1b19] sm:text-5xl md:text-6xl">
                Bring parents closer with daily updates, safer check‑ins, and
                effortless billing.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#3b3531]">
                A bright, modern platform for centers that want more time with
                children and less time with paperwork. Share updates, manage
                attendance, communicate instantly, and collect payments in one
                place.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-black"
                >
Get Started
                </a>
                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-[var(--radius)] border border-[#1e1b19]/25 bg-white/70 px-6 py-3 text-sm font-semibold text-[#1e1b19] transition hover:border-[#1e1b19]/50"
                >
                  Log in
                </a>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6 text-sm text-[#3b3531]">
                <div>
                  <div className="text-2xl font-semibold text-[#1e1b19]">
                    98%
                  </div>
                  Parent satisfaction
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#1e1b19]">
                    30%
                  </div>
                  Less admin time
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#1e1b19]">
                    24/7
                  </div>
                  Family connection
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[var(--radius)] border border-white/70 bg-white/80 p-6 shadow-xl">
                <div className="rounded-[var(--radius)] bg-[#fff7f0] p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[#1e1b19]">
                      Today at Little Steps
                    </div>
                    <div className="rounded-[var(--radius)] bg-white px-3 py-1 text-xs font-semibold text-[#6b4e3d]">
                      Live
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4">
                    {[
                      "Mila checked in at 8:02 AM",
                      "Art time: watercolors + glitter",
                      "Lunch: pasta + fruit (ate 80%)",
                      "Nap time started at 1:10 PM",
                    ].map((text) => (
                      <div
                        key={text}
                        className="rounded-[var(--radius)] bg-white px-4 py-3 text-sm text-[#3b3531] shadow-sm"
                      >
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-[var(--radius)] bg-[#e9f4ff] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2b5d8b]">
                      Attendance
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-[#1e1b19]">
                      48/50
                    </div>
                    <div className="text-sm text-[#3b3531]">
                      Checked in today
                    </div>
                  </div>
                  <div className="rounded-[var(--radius)] bg-[#fff0f6] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b2c5b]">
                      Messages
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-[#1e1b19]">
                      12
                    </div>
                    <div className="text-sm text-[#3b3531]">
                      New parent replies
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 -z-10 h-24 w-24 rounded-[var(--radius)] bg-[#1e1b19]" />
            </div>
          </div>
        </section>
      </div>

      <section id="why" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div className="rounded-[var(--radius)] bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
              Built for directors
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[#1e1b19]">
              A front office that runs itself.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#3b3531]">
              From onboarding families to collecting tuition, everything is in
              one place. You get fewer no‑shows, faster payments, and parents
              who feel more connected.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-[#3b3531]">
              <li className="rounded-[var(--radius)] bg-[#f9f5f2] px-4 py-3">
                Instant photo check‑ins with secure pick‑up lists
              </li>
              <li className="rounded-[var(--radius)] bg-[#f9f5f2] px-4 py-3">
                Daily reports sent automatically to families
              </li>
              <li className="rounded-[var(--radius)] bg-[#f9f5f2] px-4 py-3">
                One‑tap billing and autopay reminders
              </li>
            </ul>
          </div>
          <div className="grid gap-6">
            {[
              {
                title: "Parent engagement",
                body: "Share moments in real time with photos, naps, meals, and milestones.",
              },
              {
                title: "Staff‑friendly",
                body: "Reduce paper logs and keep classrooms moving with quick tap updates.",
              },
              {
                title: "Revenue confidence",
                body: "Automated tuition billing and clear payment visibility.",
              },
            ].map((item) => (
              <div
                key={item.title}
              className="rounded-[var(--radius)] border border-[#1e1b19]/10 bg-white p-6 shadow-sm"
              >
                <div className="text-lg font-semibold text-[#1e1b19]">
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#3b3531]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto w-full max-w-6xl px-6 pb-16"
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Check‑in & attendance",
              body: "Tap to check in, track ratios, and notify parents instantly.",
            },
            {
              title: "Messaging",
              body: "Broadcast updates, reminders, and urgent notices in seconds.",
            },
            {
              title: "Billing & invoices",
              body: "Collect tuition, automate receipts, and reduce late payments.",
            },
            {
              title: "Daily reports",
              body: "Meals, naps, activities, and milestones with a single send.",
            },
            {
              title: "Staff scheduling",
              body: "Plan coverage and manage shifts across rooms.",
            },
            {
              title: "Enrollment pipeline",
              body: "Track tours, waitlists, and new family onboarding.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-[var(--radius)] bg-white p-6 shadow-sm"
            >
              <div className="text-base font-semibold text-[#1e1b19]">
                {feature.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#3b3531]">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="stories" className="bg-[#1e1b19] text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5d6b2]">
                Stories
              </div>
              <h2 className="mt-3 text-3xl font-semibold">
                “Parents tell us they feel like they’re in the classroom every
                day.”
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/75">
                Little Steps Academy reduced admin time by 12 hours a week and
                improved family retention in the first semester.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm font-semibold">
              <div className="h-10 w-10 rounded-[var(--radius)] bg-[#f5d6b2]/20" />
                Maria Lopez, Director
              </div>
            </div>
            <div className="rounded-[var(--radius)] bg-white/10 p-6">
              <div className="grid gap-4">
                {[
                  ["Daily reports sent", "2,480 / month"],
                  ["Avg response time", "under 2 minutes"],
                  ["Parent NPS", "74"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-[var(--radius)] bg-white/5 px-4 py-3 text-sm"
                  >
                    <span className="text-white/70">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <a
                href="/register"
                className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-white px-5 py-3 text-sm font-semibold text-[#1e1b19] transition hover:translate-y-[-1px]"
              >
                Join free
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
              FAQ
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[#1e1b19]">
              Everything you need to start.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#3b3531]">
              We’ll help you migrate from paper logs, spreadsheets, or legacy
              systems in days.
            </p>
          </div>
          <div className="grid gap-4">
            {[
              {
                q: "How long does setup take?",
                a: "Most centers go live within a week with guided onboarding.",
              },
              {
                q: "Can parents pay tuition online?",
                a: "Yes. Autopay, invoices, and receipts are built in.",
              },
              {
                q: "Is data secure?",
                a: "We use industry‑standard encryption and role‑based access.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-[var(--radius)] bg-white p-5">
                <div className="text-sm font-semibold text-[#1e1b19]">
                  {item.q}
                </div>
                <div className="mt-2 text-sm text-[#3b3531]">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="rounded-[var(--radius)] bg-[#fff7f0] p-10 md:p-14">
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4e3d]">
                Ready to begin?
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-[#1e1b19]">
                Create an account and bring your center online today.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#3b3531]">
                Add your center, invite staff, and start sharing updates with
                families in minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[#1e1b19] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-black"
              >
                Create account
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-[var(--radius)] border border-[#1e1b19]/25 bg-white px-6 py-3 text-sm font-semibold text-[#1e1b19] transition hover:border-[#1e1b19]/50"
              >
                Log in
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#1e1b19]/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-[#3b3531] md:flex-row">
          <div>© 2026 brightsteps. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a className="hover:text-[#1e1b19]" href="/login">
              Log in
            </a>
            <a className="hover:text-[#1e1b19]" href="/register">
              Register
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
