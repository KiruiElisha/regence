frappe.ui.form.on("BOQ", {
	refresh(frm) {
		if (frm.is_new()) {
			if (!frm.doc.company)
				frm.set_value("company", frappe.defaults.get_user_default("company"));
			if (!frm.doc.currency)
				frm.set_value("currency", frappe.boot.sysdefaults.currency || "KES");
		}

		render_section_summary(frm);

		if (!frm.is_new()) {
			if (frm.doc.docstatus === 0 && !frm.doc.quotation) {
				frm.add_custom_button(__("Create Quotation"), () => {
					frappe.confirm(__("Create a Quotation from this BOQ?"), () => {
						frm.call("create_quotation").then(r => {
							if (r.message) frm.reload_doc();
						});
					});
				}, __("Create"));
			}

			if (frm.doc.quotation) {
				frm.add_custom_button(__("Quotation"), () => {
					frappe.set_route("Form", "Quotation", frm.doc.quotation);
				}, __("View"));
			}

			if (frm.doc.project) {
				frm.add_custom_button(__("Project"), () => {
					frappe.set_route("Form", "Project", frm.doc.project);
				}, __("View"));
			}
		}
	},

	project(frm) {
		if (frm.doc.project) {
			frappe.db.get_value("Project", frm.doc.project, ["customer", "estimated_costing"], r => {
				if (r) {
					if (r.customer) frm.set_value("customer", r.customer);
				}
			});
		}
	},

	overhead_percent(frm)    { recalc(frm); },
	contingency_percent(frm) { recalc(frm); },
});

frappe.ui.form.on("BOQ Item", {
	item_code(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.item_code) return;
		frappe.db.get_value("Item", row.item_code,
			["item_name", "description", "stock_uom", "standard_rate", "brand", "item_group"],
			r => {
				if (!r) return;
				frappe.model.set_value(cdt, cdn, "item_name", r.item_name || row.item_code);
				if (!row.description) {
					frappe.model.set_value(cdt, cdn, "description", r.description || r.item_name || row.item_code);
				}
				frappe.model.set_value(cdt, cdn, "uom",  r.stock_uom || "Nos");
				frappe.model.set_value(cdt, cdn, "rate", r.standard_rate || 0);
				// Auto-detect type from item_group
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

	qty(frm, cdt, cdn)  { calc_row(frm, cdt, cdn); },
	rate(frm, cdt, cdn) { calc_row(frm, cdt, cdn); },
	item_type(frm, cdt, cdn) { recalc(frm); },

	items_remove(frm) { recalc(frm); },
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
		frappe.model.set_value("BOQ Item", r.name, "amount", amt);
		const t = r.item_type || "Material";
		if (t === "Material")    mat += amt;
		else if (t === "Labour") lab += amt;
		else if (t === "Equipment") eqp += amt;
		else sub += amt;
	});

	const subtotal    = mat + lab + eqp + sub;
	const overhead    = subtotal * ((frm.doc.overhead_percent    || 0) / 100);
	const contingency = subtotal * ((frm.doc.contingency_percent || 0) / 100);
	const grand       = subtotal + overhead + contingency;

	frm.set_value("total_material_cost",    mat);
	frm.set_value("total_labour_cost",      lab);
	frm.set_value("total_equipment_cost",   eqp);
	frm.set_value("total_subcontract_cost", sub);
	frm.set_value("subtotal",           subtotal);
	frm.set_value("overhead_amount",    overhead);
	frm.set_value("contingency_amount", contingency);
	frm.set_value("grand_total",        grand);

	render_section_summary(frm);
}

function render_section_summary(frm) {
	if (frm.is_new() || !(frm.doc.items || []).length) return;

	// Group by section_title
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
