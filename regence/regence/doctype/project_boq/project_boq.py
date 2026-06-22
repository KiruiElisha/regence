import frappe
from frappe.model.document import Document
from frappe.utils import flt


class ProjectBOQ(Document):
	def validate(self) -> None:
		self.calculate_totals()

	def on_submit(self) -> None:
		self.calculate_totals()

	def calculate_totals(self) -> None:
		mat = lab = eqp = sub = 0.0

		for row in self.items:
			row.amount = flt(row.qty) * flt(row.rate)
			t = row.item_type or "Material"
			if t == "Material":
				mat += row.amount
			elif t == "Labour":
				lab += row.amount
			elif t == "Equipment":
				eqp += row.amount
			elif t in ("Subcontract", "Preliminary"):
				sub += row.amount

		self.total_material_cost    = mat
		self.total_labour_cost      = lab
		self.total_equipment_cost   = eqp
		self.total_subcontract_cost = sub

		self.subtotal           = mat + lab + eqp + sub
		self.overhead_amount    = self.subtotal * (flt(self.overhead_percent) / 100)
		self.contingency_amount = self.subtotal * (flt(self.contingency_percent) / 100)
		self.grand_total        = self.subtotal + self.overhead_amount + self.contingency_amount

		# Margin vs contract value (Sales Order)
		contract = flt(self.contract_value)
		if contract:
			self.margin_amount  = contract - self.grand_total
			self.margin_percent = (self.margin_amount / contract) * 100
			if self.margin_amount > 0:
				self.margin_status = "Profitable"
			elif self.margin_amount == 0:
				self.margin_status = "Break Even"
			else:
				self.margin_status = "Loss — BOQ exceeds contract"
		else:
			self.margin_amount  = 0
			self.margin_percent = 0
			self.margin_status  = "No Sales Order linked"

	def on_change(self) -> None:
		# Re-fetch contract value when sales_order changes
		if self.sales_order and not self.contract_value:
			cv = frappe.db.get_value("Sales Order", self.sales_order, "grand_total")
			if cv:
				self.contract_value = flt(cv)
				self.calculate_totals()
