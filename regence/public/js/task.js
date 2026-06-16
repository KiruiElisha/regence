frappe.ui.form.on("Task", {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Field Job Card"), () => {
				frappe.new_doc("Field Job Card", {
					task: frm.doc.name,
					project: frm.doc.project,
				});
			}, __("Create"));
		}
	},
});
