import frappe
from frappe import _


@frappe.whitelist()
def get_construction_dashboard():
	today = frappe.utils.today()
	month_start = frappe.utils.get_first_day(today)

	projects = frappe.db.sql("""
		SELECT name, project_name, customer, percent_complete, expected_end_date, estimated_costing
		FROM `tabProject`
		WHERE status = 'Open'
		ORDER BY expected_end_date ASC
		LIMIT 10
	""", as_dict=True)

	tasks = frappe.db.sql("""
		SELECT name, subject, project, exp_end_date, priority, status
		FROM `tabTask`
		WHERE status IN ('Open', 'Working')
		ORDER BY exp_end_date ASC
		LIMIT 30
	""", as_dict=True)

	overdue = frappe.db.sql("""
		SELECT name, subject, project, exp_end_date, priority
		FROM `tabTask`
		WHERE status IN ('Open', 'Working')
		AND exp_end_date IS NOT NULL AND exp_end_date < %s
		ORDER BY exp_end_date ASC
		LIMIT 8
	""", (today,), as_dict=True)

	fjc = frappe.db.sql("""
		SELECT name, task, project, status, scheduled_date, total_material_cost, total_service_cost
		FROM `tabField Job Card`
		WHERE DATE(creation) >= %s
		ORDER BY creation DESC
		LIMIT 8
	""", (month_start,), as_dict=True)

	mr = frappe.db.sql("""
		SELECT name, material_request_type, status, transaction_date
		FROM `tabMaterial Request`
		WHERE docstatus = 0
		LIMIT 5
	""", as_dict=True)

	pi = frappe.db.sql("""
		SELECT name, supplier, grand_total, posting_date, project
		FROM `tabPurchase Invoice`
		WHERE docstatus = 0
		ORDER BY posting_date DESC
		LIMIT 5
	""", as_dict=True)

	return {
		"projects": projects,
		"tasks": tasks,
		"overdue": overdue,
		"fjc": fjc,
		"mr": mr,
		"pi": pi,
	}


@frappe.whitelist()
def get_equipment_tracker():
	today = frappe.utils.today()
	thirty_days = frappe.utils.add_days(today, 30)

	assets = frappe.db.sql("""
		SELECT name, asset_name, asset_category, location, status,
		       purchase_date, purchase_amount, custodian
		FROM `tabAsset`
		WHERE docstatus = 1
		ORDER BY asset_name ASC
		LIMIT 50
	""", as_dict=True)

	maintenance_tasks = frappe.db.sql("""
		SELECT parent, maintenance_type, next_due_date, assign_to, description
		FROM `tabAsset Maintenance Task`
		WHERE next_due_date IS NOT NULL AND next_due_date <= %s
		ORDER BY next_due_date ASC
		LIMIT 20
	""", (thirty_days,), as_dict=True)

	repairs = frappe.db.sql("""
		SELECT name, asset_name, failure_date, repair_status, repair_cost
		FROM `tabAsset Repair`
		WHERE docstatus = 1
		ORDER BY failure_date DESC
		LIMIT 10
	""", as_dict=True)

	return {
		"assets": assets,
		"maintenance_tasks": maintenance_tasks,
		"repairs": repairs,
		"today": today,
	}


@frappe.whitelist()
def get_site_labour():
	today = frappe.utils.today()
	month_start = frappe.utils.get_first_day(today)

	all_emp = frappe.db.sql("""
		SELECT name, employee_name, department, designation
		FROM `tabEmployee`
		WHERE status = 'Active'
		LIMIT 200
	""", as_dict=True)

	att_today = frappe.db.sql("""
		SELECT employee, employee_name, status, in_time, out_time, working_hours
		FROM `tabAttendance`
		WHERE attendance_date = %s AND docstatus = 1
		ORDER BY employee_name ASC
		LIMIT 100
	""", (today,), as_dict=True)

	att_month = frappe.db.sql("""
		SELECT status, COUNT(*) as count
		FROM `tabAttendance`
		WHERE attendance_date >= %s AND docstatus = 1
		GROUP BY status
	""", (month_start,), as_dict=True)

	leaves = frappe.db.sql("""
		SELECT name, employee, employee_name, leave_type, from_date, to_date, total_leave_days
		FROM `tabLeave Application`
		WHERE status = 'Open' AND docstatus = 0
		ORDER BY from_date ASC
		LIMIT 15
	""", as_dict=True)

	slips = frappe.db.sql("""
		SELECT name, employee, employee_name, gross_pay, net_pay, start_date, end_date
		FROM `tabSalary Slip`
		WHERE docstatus = 0
		ORDER BY modified DESC
		LIMIT 10
	""", as_dict=True)

	dept = frappe.db.sql("""
		SELECT department, COUNT(*) as count
		FROM `tabEmployee`
		WHERE status = 'Active'
		GROUP BY department
		ORDER BY count DESC
		LIMIT 10
	""", as_dict=True)

	return {
		"all_emp": all_emp,
		"att_today": att_today,
		"att_month": att_month,
		"leaves": leaves,
		"slips": slips,
		"dept": dept,
		"today": today,
	}


@frappe.whitelist()
def get_overview():
	today = frappe.utils.today()
	month_start = frappe.utils.get_first_day(today)

	projects = frappe.db.sql("""
		SELECT name, project_name, percent_complete, expected_end_date, customer
		FROM `tabProject` WHERE status = 'Open'
		ORDER BY expected_end_date ASC LIMIT 5
	""", as_dict=True)

	open_tasks = frappe.db.sql("""
		SELECT COUNT(*) as cnt FROM `tabTask`
		WHERE status IN ('Open', 'Working')
	""", as_dict=True)[0].cnt or 0

	overdue_tasks = frappe.db.sql("""
		SELECT COUNT(*) as cnt FROM `tabTask`
		WHERE status IN ('Open', 'Working')
		AND exp_end_date IS NOT NULL AND exp_end_date < %s
	""", (today,), as_dict=True)[0].cnt or 0

	fjc = frappe.db.sql("""
		SELECT name, status, total_material_cost, total_service_cost
		FROM `tabField Job Card` WHERE DATE(creation) >= %s LIMIT 100
	""", (month_start,), as_dict=True)

	mr_count = frappe.db.sql("""
		SELECT COUNT(*) as cnt FROM `tabMaterial Request` WHERE docstatus = 0
	""", as_dict=True)[0].cnt or 0

	att_today = frappe.db.sql("""
		SELECT status, COUNT(*) as cnt FROM `tabAttendance`
		WHERE attendance_date = %s AND docstatus = 1
		GROUP BY status
	""", (today,), as_dict=True)

	emp_count = frappe.db.sql("""
		SELECT COUNT(*) as cnt FROM `tabEmployee` WHERE status = 'Active'
	""", as_dict=True)[0].cnt or 0

	assets = frappe.db.sql("""
		SELECT status, COUNT(*) as cnt FROM `tabAsset`
		WHERE docstatus = 1 GROUP BY status
	""", as_dict=True)

	invoices_due = frappe.db.sql("""
		SELECT SUM(grand_total) as total, COUNT(*) as cnt
		FROM `tabPurchase Invoice` WHERE docstatus = 0
	""", as_dict=True)[0]

	pi_month = frappe.db.sql("""
		SELECT SUM(grand_total) as total FROM `tabPurchase Invoice`
		WHERE docstatus = 1 AND posting_date >= %s
	""", (month_start,), as_dict=True)[0].total or 0

	pos = frappe.db.sql("""
		SELECT SUM(grand_total) as total, COUNT(*) as cnt
		FROM `tabPurchase Order`
		WHERE docstatus = 1 AND status = 'To Receive and Bill'
	""", as_dict=True)[0]

	sos = frappe.db.sql("""
		SELECT SUM(grand_total) as total, COUNT(*) as cnt
		FROM `tabSales Order`
		WHERE docstatus = 1 AND status IN ('To Deliver and Bill', 'To Bill')
	""", as_dict=True)[0]

	return {
		"projects": projects,
		"open_tasks": open_tasks,
		"overdue_tasks": overdue_tasks,
		"fjc": fjc,
		"mr_count": mr_count,
		"att_today": att_today,
		"emp_count": emp_count,
		"assets": assets,
		"invoices_due": {
			"total": invoices_due.total or 0,
			"count": invoices_due.cnt or 0,
		},
		"pi_month": pi_month,
		"pos": {"total": pos.total or 0, "count": pos.cnt or 0},
		"sos": {"total": sos.total or 0, "count": sos.cnt or 0},
		"today": today,
	}
