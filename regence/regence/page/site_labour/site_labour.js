frappe.pages["site-labour"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Site Labour"),
		single_column: true,
	});
	page.add_action_item(__("Refresh"),        () => render_all());
	page.add_action_item(__("Mark Attendance"), () => frappe.new_doc("Attendance"));
	page.add_action_item(__("Process Payroll"), () => frappe.new_doc("Payroll Entry"));
	$(page.body).html(`<div id="sl-root" style="padding:20px"></div>`);
	render_all();
};

async function render_all() {
	const root = $("#sl-root").html(
		`<div style="text-align:center;padding:40px;color:#888">${__("Loading…")}</div>`);

	const r = await frappe.call({ method: "regence.regence.api.get_site_labour" });
	const { all_emp = [], att_today = [], att_month = [], leaves = [], slips = [], dept = [], today = "" } = r.message || {};

	const att_map = {};
	att_today.forEach(a => { att_map[a.status] = (att_map[a.status]||0)+1; });
	const present  = att_map["Present"] || 0;
	const absent   = att_map["Absent"]  || 0;
	const on_leave = att_map["On Leave"]|| 0;
	const total    = all_emp.length;
	const att_rate = total ? Math.round(present/total*100) : 0;

	// att_month from Python is already grouped [{status, count}]
	const month_map = {};
	att_month.forEach(a => { month_map[a.status] = a.count || 0; });

	root.html(`
		<div class="row" style="margin-bottom:24px">
			${kpi(__("Total Employees"),    total,         "#2563EB")}
			${kpi(__("Present Today"),      `${present}<small style="font-size:.9rem"> (${att_rate}%)</small>`, "#16A34A")}
			${kpi(__("Absent Today"),       absent,        absent ? "#DC2626" : "#6B7280")}
			${kpi(__("On Leave"),           on_leave,      "#D97706")}
			${kpi(__("Pending Leaves"),     leaves.length, leaves.length ? "#7C3AED" : "#16A34A")}
			${kpi(__("Salary Slips Draft"), slips.length,  slips.length  ? "#0891B2" : "#16A34A")}
		</div>

		<div class="frappe-card" style="padding:16px;margin-bottom:16px">
			<h5 style="margin:0 0 12px">${__("Today's Attendance Rate")}</h5>
			${attendance_bar(att_map, total)}
		</div>

		<div class="row">
			<div class="col-md-7">
				<div class="frappe-card" style="padding:16px;margin-bottom:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Today's Attendance")}</h5>
						<a href="/app/attendance" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${attendance_table(att_today)}
				</div>
				<div class="frappe-card" style="padding:16px">
					<h5 style="margin:0 0 12px">${__("Month Summary")}</h5>
					${month_summary(month_map)}
				</div>
			</div>
			<div class="col-md-5">
				<div class="frappe-card" style="padding:16px;margin-bottom:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Pending Leave Applications")}</h5>
						<a href="/app/leave-application" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${leaves_list(leaves)}
				</div>
				<div class="frappe-card" style="padding:16px;margin-bottom:16px">
					<h5 style="margin:0 0 12px">${__("Department Headcount")}</h5>
					${dept_chart(dept)}
				</div>
				${slips.length ? `<div class="frappe-card" style="padding:16px">
					<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
						<h5 style="margin:0">${__("Draft Salary Slips")}</h5>
						<a href="/app/salary-slip" style="font-size:.8rem">${__("View all →")}</a>
					</div>
					${salary_list(slips)}
				</div>` : ""}
			</div>
		</div>
	`);
}

function kpi(label, value, color) {
	return `<div class="col" style="padding:4px">
		<div style="background:${color};color:#fff;border-radius:10px;padding:14px 12px;text-align:center">
			<div style="font-size:1.6rem;font-weight:700;line-height:1">${value}</div>
			<div style="font-size:.75rem;margin-top:6px;opacity:.9;line-height:1.3">${label}</div>
		</div>
	</div>`;
}

function attendance_bar(map, total) {
	if (!total) return `<p class="text-muted small">${__("No employees")}</p>`;
	const sc = {Present:"#16A34A",Absent:"#DC2626","Half Day":"#D97706","On Leave":"#2563EB",Holiday:"#9CA3AF"};
	const segs = Object.entries(map).map(([s,n])=>
		`<div style="width:${Math.round(n/total*100)}%;background:${sc[s]||"#9CA3AF"};height:28px" title="${__(s)}: ${n}"></div>`
	).join("");
	const legend = Object.entries(map).map(([s,n])=>
		`<div style="display:flex;align-items:center;gap:5px;font-size:.8rem">
			<div style="width:10px;height:10px;border-radius:3px;background:${sc[s]||"#9CA3AF"}"></div>
			<span>${__(s)} <strong>${n}</strong></span>
		</div>`).join("");
	return `<div style="display:flex;border-radius:8px;overflow:hidden;margin-bottom:10px">${segs}</div>
		<div style="display:flex;flex-wrap:wrap;gap:12px">${legend}</div>`;
}

function attendance_table(rows) {
	if (!rows.length) return `<p class="text-muted small">${__("No attendance records for today")}</p>`;
	const sc = {Present:"green",Absent:"red","Half Day":"orange","On Leave":"blue",Holiday:"gray"};
	return `<table class="table table-sm" style="font-size:.82rem;margin:0">
		<thead style="background:#f9fafb"><tr>
			<th>${__("Employee")}</th><th>${__("Status")}</th>
			<th>${__("In")}</th><th>${__("Out")}</th><th>${__("Hrs")}</th>
		</tr></thead>
		<tbody>${rows.map(a=>`<tr>
			<td><a href="/app/employee/${a.employee}">${a.employee_name}</a></td>
			<td>${pill(a.status, sc)}</td>
			<td style="color:#6b7280;font-size:.78rem">${a.in_time ? String(a.in_time).substring(0,5) : "—"}</td>
			<td style="color:#6b7280;font-size:.78rem">${a.out_time ? String(a.out_time).substring(0,5) : "—"}</td>
			<td>${a.working_hours ? parseFloat(a.working_hours).toFixed(1) : "—"}</td>
		</tr>`).join("")}</tbody>
	</table>`;
}

function month_summary(map) {
	if (!Object.keys(map).length) return `<p class="text-muted small">${__("No data this month")}</p>`;
	const total = Object.values(map).reduce((s,n)=>s+n,0);
	const sc = {Present:"#16A34A",Absent:"#DC2626","Half Day":"#D97706","On Leave":"#2563EB",Holiday:"#9CA3AF"};
	return `<table class="table table-sm" style="font-size:.82rem;margin:0">
		<tbody>${Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([s,n])=>{
			const pct = Math.round(n/total*100);
			return `<tr>
				<td style="width:110px">${__(s)}</td>
				<td><div style="display:flex;align-items:center;gap:8px">
					<div style="flex:1;background:#e5e7eb;border-radius:4px;height:8px">
						<div style="background:${sc[s]||"#9CA3AF"};width:${pct}%;height:8px;border-radius:4px"></div>
					</div>
					<span style="min-width:30px;text-align:right;font-weight:600">${n}</span>
					<span style="color:#6b7280;min-width:32px">${pct}%</span>
				</div></td>
			</tr>`;
		}).join("")}</tbody>
	</table>`;
}

function leaves_list(rows) {
	if (!rows.length) return `<p class="text-muted small">✓ ${__("No pending leave applications")}</p>`;
	return `<div>${rows.map(l=>`
		<div style="padding:8px 0;border-bottom:1px solid #f3f4f6">
			<div style="display:flex;justify-content:space-between;align-items:center">
				<a href="/app/leave-application/${l.name}" style="font-size:.85rem;font-weight:500">${l.employee_name}</a>
				<span style="font-size:.75rem;background:#fef9c3;color:#92400e;border-radius:12px;padding:2px 8px">${l.leave_type}</span>
			</div>
			<div style="display:flex;justify-content:space-between;margin-top:2px">
				<span style="font-size:.75rem;color:#6b7280">
					${frappe.format(l.from_date,{fieldtype:"Date"})} → ${frappe.format(l.to_date,{fieldtype:"Date"})}
				</span>
				<span style="font-size:.75rem;font-weight:600">${l.total_leave_days} ${__("day(s)")}</span>
			</div>
		</div>`).join("")}</div>`;
}

function dept_chart(dept) {
	if (!dept.length) return `<p class="text-muted small">${__("No data")}</p>`;
	const max = Math.max(...dept.map(d=>d.count));
	return `<div>${dept.map(d=>`
		<div style="margin-bottom:8px">
			<div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:2px">
				<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${d.department||__("No Dept")}</span>
				<span style="font-weight:600">${d.count}</span>
			</div>
			<div style="background:#e5e7eb;border-radius:4px;height:8px">
				<div style="background:#2563EB;width:${Math.round(d.count/max*100)}%;height:8px;border-radius:4px"></div>
			</div>
		</div>`).join("")}</div>`;
}

function salary_list(rows) {
	return `<table class="table table-sm" style="font-size:.82rem;margin:0">
		<thead style="background:#f9fafb"><tr>
			<th>${__("Employee")}</th><th style="text-align:right">${__("Net Pay")}</th>
		</tr></thead>
		<tbody>${rows.map(s=>`<tr>
			<td><a href="/app/salary-slip/${s.name}">${s.employee_name}</a></td>
			<td style="text-align:right;font-weight:600">${frappe.format(s.net_pay||0,{fieldtype:"Currency"})}</td>
		</tr>`).join("")}</tbody>
	</table>`;
}

function pill(label, color_map) {
	const colors = {green:"#dcfce7|#16A34A",blue:"#dbeafe|#2563EB",red:"#fee2e2|#DC2626",
		orange:"#ffedd5|#D97706",gray:"#f3f4f6|#6B7280"};
	const [bg,fg] = (colors[color_map[label]||"gray"]||colors.gray).split("|");
	return `<span style="background:${bg};color:${fg};border-radius:12px;padding:2px 9px;font-size:.72rem;font-weight:600">${__(label)}</span>`;
}
