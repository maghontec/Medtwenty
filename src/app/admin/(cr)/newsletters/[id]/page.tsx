import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { get, scalar } from "@/lib/db";
import { renderIssueHtml, type Issue, type IssueBlocks } from "@/lib/newsletters";
import { issueAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHead, Panel } from "../../ui";
import { ConfirmButton } from "@/components/client";

export const metadata = { title: "Newsletter issue" };

export default async function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff();
  const id = Number((await params).id);
  const sp = await searchParams;
  const issue = get<Issue & { name: string; is_premium: number }>("SELECT i.*, n.name, n.is_premium FROM newsletter_issues i JOIN newsletters n ON n.id = i.newsletter_id WHERE i.id = ?", id);
  if (!issue) notFound();
  const b = JSON.parse(issue.blocks || "{}") as IssueBlocks;
  const html = renderIssueHtml(issue, "#unsubscribe");
  const editable = ["draft", "scheduled"].includes(issue.status);
  const audience = scalar<number>("SELECT COUNT(*) FROM newsletter_subscribers WHERE newsletter_id = ? AND status = 'confirmed'", issue.newsletter_id);
  return (
    <>
      <PageHead
        title={issue.subject}
        sub={`${issue.name} · ${audience} confirmed subscribers${issue.is_premium ? " (Premium entitlement checked at send time)" : ""}`}
        actions={<Link href="/admin/newsletters" className="btn btn-outline btn-sm">All issues</Link>}
      />
      <Flash sp={sp} />
      <p className="mb-4 flex items-center gap-2 text-sm">
        <Badge s={issue.status} />
        {issue.scheduled_for && issue.status === "scheduled" && <span>Sends {formatDateTime(issue.scheduled_for)}</span>}
        {issue.sent_at && <span>Sent {formatDateTime(issue.sent_at)} to {issue.recipients}</span>}
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Issue">
          <form action={issueAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <fieldset disabled={!editable} className="space-y-4">
              <div><label className="label" htmlFor="subject">Subject</label><input id="subject" name="subject" defaultValue={issue.subject} className="input" /></div>
              <div><label className="label" htmlFor="pre">Preheader</label><input id="pre" name="preheader" defaultValue={issue.preheader || ""} className="input" /></div>
              <div><label className="label" htmlFor="intro">Intro</label><textarea id="intro" name="intro" rows={3} defaultValue={b.intro || ""} className="input" /></div>
              <div><label className="label" htmlFor="ov">Briefing overview</label><textarea id="ov" name="overview" rows={6} defaultValue={b.overview || ""} className="input" /></div>
              <div>
                <label className="label" htmlFor="stories">Story list (JSON: headline, standfirst, why, url, premium)</label>
                <textarea id="stories" name="stories" rows={8} defaultValue={JSON.stringify(b.stories || [], null, 2)} className="input font-mono text-xs" />
              </div>
              <div><label className="label" htmlFor="so">Sign-off</label><textarea id="so" name="signoff" rows={2} defaultValue={b.signoff || ""} className="input" /></div>
            </fieldset>
            {editable && (
              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <button name="op" value="save" className="btn btn-outline btn-sm">Save</button>
                <button name="op" value="test" className="btn btn-outline btn-sm">Send test to me</button>
                <div>
                  <label className="label text-xs" htmlFor="when">Schedule (UTC; Friday 17:00 UK is 16:00 UTC in summer)</label>
                  <input id="when" type="datetime-local" name="when" className="input py-1.5 text-sm" />
                </div>
                <button name="op" value="schedule" className="btn btn-outline btn-sm">Schedule</button>
                {issue.status === "scheduled" && <button name="op" value="unschedule" className="btn btn-outline btn-sm">Back to draft</button>}
                <ConfirmButton name="op" value="send" className="btn btn-primary btn-sm" message={`Send "${issue.subject}" to ${audience} subscribers now?`}>Send now</ConfirmButton>
                <ConfirmButton name="op" value="cancel" className="btn btn-outline btn-sm text-down" message="Cancel this issue? It will not be sent.">Cancel issue</ConfirmButton>
              </div>
            )}
          </form>
        </Panel>
        <Panel title="Preview">
          <div className="grid gap-4 2xl:grid-cols-[1fr_390px]">
            <div>
              <p className="mb-1 text-xs text-muted">Desktop</p>
              <iframe title="Desktop preview" srcDoc={html} sandbox="" className="h-[640px] w-full rounded border border-line bg-white" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Mobile (375px)</p>
              <iframe title="Mobile preview" srcDoc={html} sandbox="" className="h-[640px] w-[375px] max-w-full rounded border border-line bg-white" />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
