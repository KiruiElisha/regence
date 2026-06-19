import frappe
from frappe.model.document import Document
from frappe.utils import flt


class BOQ(Document):
	def validate(self) -> None:
		self.calculate_totals()

	def on_submit(self) -> None:
		self.calculate_totals()

	def calculate_totals(self) -> None:
		mat = lab = eqp = sub = 0.0

		for row in self.items:
			qty = getattr(row, "qty", None) or getattr(row, "quantity", None) or 0
			row.amount = qty * (row.rate or 0)
			t = getattr(row, "item_type", None) or "Material"
			if t == "Material":
				mat += row.amount
			elif t == "Labour":
				lab += row.amount
			elif t == "Equipment":
				eqp += row.amount
			elif t in ("Subcontract", "Preliminary"):
				sub += row.amount

		self.total_material_cost  = mat
		self.total_labour_cost    = lab
		self.total_equipment_cost = eqp
		self.total_subcontract_cost = sub

		self.subtotal = mat + lab + eqp + sub
		self.overhead_amount    = self.subtotal * (flt(self.overhead_percent) / 100)
		self.contingency_amount = self.subtotal * (flt(self.contingency_percent) / 100)
		self.grand_total = self.subtotal + self.overhead_amount + self.contingency_amount

	@frappe.whitelist()
	def create_quotation(self) -> str:
		if not self.items:
			frappe.throw(frappe._("No items to create a quotation for"))
		if self.quotation:
			frappe.throw(frappe._("Quotation {0} already exists for this BOQ").format(self.quotation))

		qt = frappe.new_doc("Quotation")
		qt.quotation_to = "Customer"
		qt.party_name   = self.customer
		qt.project      = self.project
		qt.currency     = self.currency or frappe.defaults.get_global_default("currency") or "KES"
		qt.valid_till   = self.valid_until
		qt.remarks      = frappe._("BOQ: {0} — {1}").format(self.name, self.title or "")

		for row in self.items:
			qt.append("items", {
				"item_code":   row.item_code or frappe.db.get_value("Item", {"item_name": "Services"}, "name") or row.item_code,
				"item_name":   row.item_name or row.description,
				"description": row.description or row.item_name,
				"qty":         row.qty,
				"uom":         row.uom or "Nos",
				"rate":        row.rate,
			})

		qt.insert()
		self.db_set("quotation", qt.name)
		frappe.msgprint(frappe._("Quotation {0} created").format(
			frappe.utils.get_link_to_form("Quotation", qt.name)), alert=True)
		return qt.name
