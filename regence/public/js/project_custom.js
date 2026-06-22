frappe.ui.form.on("Project", {
	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(__("Create Project BOQ"), () => {
			frappe.db.get_value(
				"Project BOQ",
				{ project: frm.doc.name },
				"name",
				r => {
					if (r && r.name) {
						frappe.set_route("Form", "Project BOQ", r.name);
					} else {
						const boq_vals = {
							project: frm.doc.name,
							company: frm.doc.company || frappe.defaults.get_user_default("company"),
							title: frm.doc.project_name || frm.doc.name,
						};
						if (frm.doc.customer) boq_vals.customer = frm.doc.customer;

						frappe.db.get_list("Sales Order", {
							filters: { project: frm.doc.name, docstatus: 1 },
							fields: ["name", "grand_total"],
							limit: 1,
						}).then(sos => {
							if (sos && sos.length) {
								boq_vals.sales_order    = sos[0].name;
								boq_vals.contract_value = sos[0].grand_total;
							}
							frappe.new_doc("Project BOQ", boq_vals);
						});
					}
				}
			);
		}, __("Create"));

		// Quick-navigate to existing BOQ(s)
		frappe.db.get_list("Project BOQ", {
			filters: { project: frm.doc.name },
			fields:  ["name", "status", "grand_total"],
			limit:   5,
		}).then(boqs => {
			if (!boqs || !boqs.length) return;
			frm.add_custom_button(__("Project BOQ"), () => {
				if (boqs.length === 1) {
					frappe.set_route("Form", "Project BOQ", boqs[0].name);
				} else {
					frappe.set_route("List", "Project BOQ", { project: frm.doc.name });
				}
			}, __("View"));

			// Inject BOQ summary tile below the form header
			const existing = frm.fields_dict.__messages;
			const container = frm.$wrapper.find(".form-dashboard-section").first();
			const banner_id = `boq-summary-${frm.doc.name}`.replace(/[^a-z0-9-]/gi, "-");
			if ($(`#${banner_id}`).length) return;

			const total = boqs.reduce((s, b) => s + (b.grand_total || 0), 0);
			const status_col = {
				Draft: "#6B7280", Submitted: "#2563EB", Approved: "#16A34A",
				Rejected: "#DC2626", Cancelled: "#6B7280",
			};
			const pills = boqs.map(b =>
				`<a href="/app/project-boq/${b.name}" style="background:${status_col[b.status]||"#6b7280"}18;
					border:1px solid ${status_col[b.status]||"#6b7280"}40;border-radius:20px;
					padding:4px 10px;font-size:.75rem;color:${status_col[b.status]||"#374151"};
					text-decoration:none;font-weight:600">${b.name} · ${b.status}</a>`
			).join(" ");

			const tile = $(`
				<div id="${banner_id}" style="margin:8px 0 4px;padding:12px 16px;
					background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:.85rem">
					<span style="font-weight:600;color:#1e40af">${__("BOQs")}: </span>
					${pills}
					<span style="float:right;font-weight:700;color:#1e40af">
						${__("Total BOQ Cost")}: ${frappe.format(total, {fieldtype:"Currency"})}
					</span>
				</div>`);

			frm.$wrapper.find(".layout-main-section").prepend(tile);
		});
	},
});
