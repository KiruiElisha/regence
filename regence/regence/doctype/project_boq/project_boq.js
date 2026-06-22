frappe.ui.form.on("Project BOQ", {
	refresh(frm) {
		if (frm.is_new()) {
			if (!frm.doc.company)
				frm.set_value("company", frappe.defaults.get_user_default("company"));
			if (!frm.doc.currency)
				frm.set_value("currency", frappe.boot.sysdefaults.currency || "KES");
		}

		render_margin_banner(frm);
		render_section_summary(frm);

		if (!frm.is_new()) {
			if (frm.doc.project) {
				frm.add_custom_button(__("Project"), () => {
					frappe.set_route("Form", "Project", frm.doc.project);
				}, __("View"));
			}
			if (frm.doc.sales_order) {
				frm.add_custom_button(__("Sales Order"), () => {
					frappe.set_route("Form", "Sales Order", frm.doc.sales_order);
				}, __("View"));
			}
		}
	},

	project(frm) {
		if (frm.doc.project) {
			frappe.db.get_value("Project", frm.doc.project, ["customer"], r => {
				if (r && r.customer) frm.set_value("customer", r.customer);
			});
		}
	},

	sales_order(frm) {
		if (frm.doc.sales_order) {
			frappe.db.get_value("Sales Order", frm.doc.sales_order,
				["grand_total", "customer", "project"], r => {
					if (!r) return;
					frm.set_value("contract_value", r.grand_total || 0);
					if (!frm.doc.customer && r.customer)
						frm.set_value("customer", r.customer);
					if (!frm.doc.project && r.project)
						frm.set_value("project", r.project);
					recalc(frm);
				}
			);
		} else {
			frm.set_value("contract_value", 0);
			recalc(frm);
		}
	},

	contract_value(frm) { recalc(frm); },
	overhead_percent(frm)    { recalc(frm); },
	contingency_percent(frm) { recalc(frm); },
});

frappe.ui.form.on("Project BOQ Item", {
	item_code(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.item_code) return;
		frappe.db.get_value("Item", row.item_code,
			["item_name", "description", "stock_uom", "standard_rate", "brand", "item_group"],
			r => {
				if (!r) return;
				frappe.model.set_value(cdt, cdn, "item_name", r.item_name || row.item_code);
				if (!row.description)
					frappe.model.set_value(cdt, cdn, "description", r.description || r.item_name || row.item_code);
				frappe.model.set_value(cdt, cdn, "uom",  r.stock_uom || "Nos");
				frappe.model.set_value(cdt, cdn, "rate", r.standard_rate || 0);

				const grp = (r.item_group || "").toLowerCase();
				let type = "Material";
				if (grp.includes("labour") || grp.includes("labor")) type = "Labour";
				else if (grp.includes("equipment") || grp.includes("plant")) type = "Equipment";
				else if (grp.includes("subcontract")) type = "Subcontract";
				frappe.model.set_value(cdt, cdn, "item_type", type);
				calc_row(frm, cdt, cdn);
			}
		);
	},

	qty(frm, cdt, cdn)       { calc_row(frm, cdt, cdn); },
	rate(frm, cdt, cdn)      { calc_row(frm, cdt, cdn); },
	item_type(frm, cdt, cdn) { recalc(frm); },
	items_remove(frm)        { recalc(frm); },
});

function calc_row(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	frappe.model.set_value(cdt, cdn, "amount", (row.qty || 0) * (row.rate || 0));
	recalc(frm);
}

function recalc(frm) {
	let mat = 0, lab = 0, eqp = 0, sub = 0;
	(frm.doc.items || []).forEach(r => {
		const amt = (r.qty || 0) * (r.rate || 0);
		frappe.model.set_value("Project BOQ Item", r.name, "amount", amt);
		const t = r.item_type || "Material";
		if (t === "Material")       mat += amt;
		else if (t === "Labour")    lab += amt;
		else if (t === "Equipment") eqp += amt;
		else                        sub += amt;
	});

	const subtotal    = mat + lab + eqp + sub;
	const overhead    = subtotal * ((frm.doc.overhead_percent    || 0) / 100);
	const contingency = subtotal * ((frm.doc.contingency_percent || 0) / 100);
	const grand       = subtotal + overhead + contingency;
	const contract    = frm.doc.contract_value || 0;
	const margin      = contract - grand;
	const margin_pct  = contract ? (margin / contract * 100) : 0;

	frm.set_value("total_material_cost",    mat);
	frm.set_value("total_labour_cost",      lab);
	frm.set_value("total_equipment_cost",   eqp);
	frm.set_value("total_subcontract_cost", sub);
	frm.set_value("subtotal",           subtotal);
	frm.set_value("overhead_amount",    overhead);
	frm.set_value("contingency_amount", contingency);
	frm.set_value("grand_total",        grand);
	frm.set_value("margin_amount",      margin);
	frm.set_value("margin_percent",     parseFloat(margin_pct.toFixed(2)));

	let status = "No Sales Order linked";
	if (contract) {
		status = margin > 0 ? "Profitable" : margin === 0 ? "Break Even" : "Loss — BOQ exceeds contract";
	}
	frm.set_value("margin_status", status);

	render_margin_banner(frm);
	render_section_summary(frm);
}

function render_margin_banner(frm) {
	const contract = frm.doc.contract_value || 0;
	const grand    = frm.doc.grand_total    || 0;
	const margin   = frm.doc.margin_amount  || 0;
	const pct      = frm.doc.margin_percent || 0;

	if (!contract) {
		frm.set_df_property("section_break_margin", "description",
			`<div style="padding:10px;background:#f9fafb;border-radius:6px;color:#6b7280;font-size:.85rem">
				Link a <strong>Sales Order</strong> to see margin analysis.
			</div>`);
		return;
	}

	const profitable = margin >= 0;
	const bg   = profitable ? "#f0fdf4" : "#fef2f2";
	const col  = profitable ? "#16A34A" : "#DC2626";
	const icon = profitable ? "📈" : "📉";

	frm.set_df_property("section_break_margin", "description",
		`<div style="padding:14px;background:${bg};border:1px solid ${col}30;border-radius:8px;display:flex;gap:32px;align-items:center;flex-wrap:wrap">
			<div style="text-align:center">
				<div style="font-size:.75rem;color:#6b7280">${__("Contract Value")}</div>
				<div style="font-size:1.1rem;font-weight:700;color:#2563EB">${frappe.format(contract,{fieldtype:"Currency"})}</div>
			</div>
			<div style="font-size:1.2rem;color:#6b7280">−</div>
			<div style="text-align:center">
				<div style="font-size:.75rem;color:#6b7280">${__("BOQ Total Cost")}</div>
				<div style="font-size:1.1rem;font-weight:700;color:#374151">${frappe.format(grand,{fieldtype:"Currency"})}</div>
			</div>
			<div style="font-size:1.2rem;color:#6b7280">=</div>
			<div style="text-align:center">
				<div style="font-size:.75rem;color:#6b7280">${__("Margin")}</div>
				<div style="font-size:1.3rem;font-weight:700;color:${col}">${icon} ${frappe.format(Math.abs(margin),{fieldtype:"Currency"})}</div>
				<div style="font-size:.8rem;color:${col};font-weight:600">${pct.toFixed(1)}%</div>
			</div>
			<div style="flex:1;min-width:120px">
				<div style="font-size:.78rem;font-weight:600;color:${col};background:${col}15;border-radius:20px;padding:4px 12px;display:inline-block">
					${__(frm.doc.margin_status || "")}
				</div>
			</div>
		</div>`
	);
	frm.refresh_field("section_break_margin");
}

function render_section_summary(frm) {
	if (frm.is_new() || !(frm.doc.items || []).length) return;

	const sections = {};
	const type_totals = {Material:0, Labour:0, Equipment:0, Subcontract:0, Preliminary:0};
	(frm.doc.items || []).forEach(r => {
		const sec = r.section_title || __("General");
		if (!sections[sec]) sections[sec] = {total:0, rows:0};
		const amt = (r.qty||0)*(r.rate||0);
		sections[sec].total += amt;
		sections[sec].rows++;
		type_totals[r.item_type || "Material"] = (type_totals[r.item_type || "Material"] || 0) + amt;
	});

	const grand = frm.doc.grand_total || 0;

	let html = `<div style="margin-top:8px">
		<div style="font-size:.8rem;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">${__("Section Breakdown")}</div>
		<table class="table table-sm" style="font-size:.82rem;margin:0 0 10px">
			<thead style="background:#f9fafb"><tr>
				<th>${__("Section")}</th><th style="text-align:right">${__("Items")}</th>
				<th style="text-align:right">${__("Amount")}</th><th style="text-align:right">${__("Share")}</th>
			</tr></thead>
			<tbody>${Object.entries(sections).map(([sec, v]) => {
				const pct = grand ? Math.round(v.total / grand * 100) : 0;
				return `<tr>
					<td><strong>${sec}</strong></td>
					<td style="text-align:right;color:#6b7280">${v.rows}</td>
					<td style="text-align:right;font-weight:600">${frappe.format(v.total,{fieldtype:"Currency"})}</td>
					<td style="text-align:right">
						<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
							<div style="width:60px;background:#e5e7eb;border-radius:3px;height:6px">
								<div style="background:#2563EB;width:${pct}%;height:6px;border-radius:3px"></div>
							</div>
							<span style="color:#6b7280;min-width:30px">${pct}%</span>
						</div>
					</td>
				</tr>`;
			}).join("")}</tbody>
		</table>
		<div style="font-size:.8rem;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">${__("By Type")}</div>
		<div style="display:flex;flex-wrap:wrap;gap:8px">
			${Object.entries(type_totals).filter(([,v])=>v>0).map(([t,v]) => {
				const colors = {Material:"#2563EB",Labour:"#16A34A",Equipment:"#D97706",Subcontract:"#7C3AED",Preliminary:"#6B7280"};
				return `<div style="background:${colors[t]||"#6b7280"}18;border:1px solid ${colors[t]||"#6b7280"}40;border-radius:8px;padding:6px 12px;font-size:.8rem">
					<span style="color:#374151">${__(t)}</span>
					<span style="font-weight:700;color:${colors[t]||"#6b7280"};margin-left:8px">${frappe.format(v,{fieldtype:"Currency"})}</span>
				</div>`;
			}).join("")}
		</div>
	</div>`;

	frm.set_df_property("items", "description", html);
	frm.refresh_field("items");
}
