frappe.pages["construction-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Construction Dashboard"),
		single_column: true,
	});
	page.add_action_item(__("Refresh"), () => render_all());
	$(page.body).html(`<div id="cd-root" style="padding:20px"></div>`);
	render_all();
};

async function render_all() {
	const root = $("#cd-root").html(
		`<div style="text-align:center;padding:40px;color:#888">${__("Loading…")}</div>`);

	const r = await frappe.call({ method: "regence.regence.api.get_construction_dashboard" });
	const d = r.message || {};
	const { projects = [], tasks = [], overdue = [], fjc = [], mr = [], pi = [] } = d;

	root.html(`
		<div class="row" style="margin-bottom:24px">
			${kpi(__("Active Projects"), projects.length, "#2563EB")}
			${kpi(__("Open Tasks"),      tasks.length,    "#D97706")}
			${kpi(__("Overdue Tasks"),   overdue.length,  overdue.length ? "#DC2626" : "#16A34A")}
			${kpi(__("FJC This Month"),  fjc.length,      "#7C3AED")}
			${kpi(__("Pending MRs"),     mr.length,       "#0891B2")}
		</div>

		<div class="row">
			<div class="col-md-7">
				<div class="frappe-card" style="padding:16px;margin-bottom:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Active Projects")}</h5>
						<a href="/app/project" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${projects_table(projects)}
				</div>
				<div class="frappe-card" style="padding:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0;color:${overdue.length ? "#DC2626" : "inherit"}">${__("Overdue Tasks")}
							${overdue.length ? `<span style="background:#DC2626;color:#fff;border-radius:12px;padding:1px 8px;font-size:.75rem;margin-left:6px">${overdue.length}</span>` : ""}
						</h5>
					</div>
					${overdue_table(overdue)}
				</div>
			</div>
			<div class="col-md-5">
				<div class="frappe-card" style="padding:16px;margin-bottom:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Field Job Cards")}</h5>
						<a href="/app/field-job-card" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${fjc_list(fjc)}
				</div>
				<div class="frappe-card" style="padding:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Draft Purchase Invoices")}</h5>
						<a href="/app/purchase-invoice" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${pi_list(pi)}
				</div>
			</div>
		</div>
	`);
}

function kpi(label, value, color) {
	return `<div class="col" style="padding:4px">
		<div style="background:${color};color:#fff;border-radius:10px;padding:18px 16px;text-align:center">
			<div style="font-size:1.8rem;font-weight:700;line-height:1">${value}</div>
			<div style="font-size:.8rem;margin-top:6px;opacity:.9;line-height:1.2">${label}</div>
		</div>
	</div>`;
}

function progress_bar(pct) {
	const color = pct >= 75 ? "#16A34A" : pct >= 40 ? "#D97706" : "#DC2626";
	return `<div style="display:flex;align-items:center;gap:6px">
		<div style="flex:1;background:#e5e7eb;border-radius:4px;height:6px">
			<div style="background:${color};width:${pct||0}%;height:6px;border-radius:4px"></div>
		</div>
		<span style="font-size:.75rem;color:#6b7280;min-width:28px">${pct||0}%</span>
	</div>`;
}

function projects_table(rows) {
	if (!rows.length) return `<p class="text-muted small">${__("No active projects")}</p>`;
	const today = frappe.datetime.get_today();
	return `<table class="table table-sm" style="font-size:.82rem;margin:0">
		<thead style="background:#f9fafb"><tr>
			<th>${__("Project")}</th><th>${__("Customer")}</th>
			<th style="width:140px">${__("Progress")}</th><th>${__("Due")}</th>
		</tr></thead>
		<tbody>${rows.map(p=>`<tr>
			<td><a href="/app/project/${p.name}">${p.project_name}</a></td>
			<td style="color:#6b7280">${p.customer||"—"}</td>
			<td>${progress_bar(p.percent_complete)}</td>
			<td style="white-space:nowrap;${p.expected_end_date < today ? "color:#DC2626;font-weight:600":""}">
				${p.expected_end_date ? frappe.format(p.expected_end_date,{fieldtype:"Date"}) : "—"}
			</td>
		</tr>`).join("")}</tbody>
	</table>`;
}

function overdue_table(rows) {
	if (!rows.length) return `<p class="text-muted small" style="color:#16A34A">✓ ${__("No overdue tasks")}</p>`;
	return `<table class="table table-sm" style="font-size:.82rem;margin:0">
		<thead style="background:#fef2f2"><tr>
			<th>${__("Task")}</th><th>${__("Project")}</th>
			<th>${__("Due")}</th><th>${__("Priority")}</th>
		</tr></thead>
		<tbody>${rows.map(t=>`<tr>
			<td><a href="/app/task/${t.name}">${t.subject||t.name}</a></td>
			<td style="color:#6b7280">${t.project||"—"}</td>
			<td style="color:#DC2626;font-weight:600">${t.exp_end_date ? frappe.format(t.exp_end_date,{fieldtype:"Date"}) : "—"}</td>
			<td>${pill(t.priority||"Low",{High:"red",Medium:"orange",Low:"blue"})}</td>
		</tr>`).join("")}</tbody>
	</table>`;
}

function fjc_list(rows) {
	if (!rows.length) return `<p class="text-muted small">${__("No field job cards this month")}</p>`;
	return `<div>${rows.map(c=>`
		<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
			<div>
				<a href="/app/field-job-card/${c.name}" style="font-weight:500;font-size:.85rem">${c.name}</a>
				<div style="font-size:.75rem;color:#6b7280">${c.project||c.task||"—"}</div>
			</div>
			<div style="text-align:right">
				${pill(c.status,{Draft:"gray","In Progress":"blue",Completed:"green",Cancelled:"red"})}
				<div style="font-size:.75rem;color:#6b7280;margin-top:2px">
					${frappe.format((c.total_material_cost||0)+(c.total_service_cost||0),{fieldtype:"Currency"})}
				</div>
			</div>
		</div>`).join("")}</div>`;
}

function pi_list(rows) {
	if (!rows.length) return `<p class="text-muted small">${__("No draft invoices")}</p>`;
	return `<div>${rows.map(i=>`
		<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
			<div>
				<a href="/app/purchase-invoice/${i.name}" style="font-weight:500;font-size:.85rem">${i.name}</a>
				<div style="font-size:.75rem;color:#6b7280">${i.supplier||""}</div>
			</div>
			<div style="text-align:right;font-weight:600;font-size:.85rem">
				${frappe.format(i.grand_total,{fieldtype:"Currency"})}
				<div style="font-size:.75rem;color:#6b7280;font-weight:normal">${i.project||""}</div>
			</div>
		</div>`).join("")}</div>`;
}

function pill(label, color_map) {
	const colors = {green:"#dcfce7|#16A34A",blue:"#dbeafe|#2563EB",red:"#fee2e2|#DC2626",
		orange:"#ffedd5|#D97706",gray:"#f3f4f6|#6B7280"};
	const [bg,fg] = (colors[color_map[label]||"gray"]||colors.gray).split("|");
	return `<span style="background:${bg};color:${fg};border-radius:12px;padding:2px 10px;font-size:.72rem;font-weight:600">${__(label)}</span>`;
}
