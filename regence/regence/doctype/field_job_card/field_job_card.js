frappe.ui.form.on("Field Job Card", {
	refresh(frm) {
		if (!frm.is_new()) {
			if ((frm.doc.materials || []).length && !frm.doc.stock_entry) {
				frm.add_custom_button(__("Consume Materials"), () => {
					frm.call("consume_materials").then(r => {
						if (r.message) {
							frappe.set_route("Form", "Stock Entry", r.message);
						}
					});
				}, __("Actions"));
			}

			if ((frm.doc.services || []).length) {
				frm.add_custom_button(__("Create Purchase Invoice"), () => {
					frappe.confirm(__("Create Purchase Invoice(s) for the listed services?"), () => {
						frm.call("create_purchase_invoice").then(() => frm.refresh());
					});
				}, __("Actions"));
			}

			if (frm.doc.stock_entry) {
				frm.add_custom_button(__("Stock Entry"), () => {
					frappe.set_route("Form", "Stock Entry", frm.doc.stock_entry);
				}, __("View"));
			}

			if (frm.doc.purchase_invoice) {
				frm.add_custom_button(__("Purchase Invoice"), () => {
					frappe.set_route("Form", "Purchase Invoice", frm.doc.purchase_invoice);
				}, __("View"));
			}
		}
	},
});

frappe.ui.form.on("Field Job Card Material", {
	item_code(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.item_code) {
			frappe.db.get_value("Item", row.item_code, ["item_name", "stock_uom", "standard_rate"], (v) => {
				frappe.model.set_value(cdt, cdn, "item_name", v.item_name);
				frappe.model.set_value(cdt, cdn, "uom", v.stock_uom);
				frappe.model.set_value(cdt, cdn, "rate", v.standard_rate);
				calc_material_amount(frm, cdt, cdn);
			});
		}
	},
	qty: (frm, cdt, cdn) => calc_material_amount(frm, cdt, cdn),
	rate: (frm, cdt, cdn) => calc_material_amount(frm, cdt, cdn),
});

frappe.ui.form.on("Field Job Card Service", {
	item_code(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.item_code) {
			frappe.db.get_value("Item", row.item_code, ["item_name", "stock_uom", "standard_rate"], (v) => {
				frappe.model.set_value(cdt, cdn, "item_name", v.item_name);
				frappe.model.set_value(cdt, cdn, "uom", v.stock_uom);
				frappe.model.set_value(cdt, cdn, "rate", v.standard_rate);
				calc_service_amount(frm, cdt, cdn);
			});
		}
	},
	qty: (frm, cdt, cdn) => calc_service_amount(frm, cdt, cdn),
	rate: (frm, cdt, cdn) => calc_service_amount(frm, cdt, cdn),
});

function calc_material_amount(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	frappe.model.set_value(cdt, cdn, "amount", (row.qty || 0) * (row.rate || 0));
	frm.set_value("total_material_cost", (frm.doc.materials || []).reduce((s, r) => s + (r.amount || 0), 0));
}

function calc_service_amount(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	frappe.model.set_value(cdt, cdn, "amount", (row.qty || 0) * (row.rate || 0));
	frm.set_value("total_service_cost", (frm.doc.services || []).reduce((s, r) => s + (r.amount || 0), 0));
}
