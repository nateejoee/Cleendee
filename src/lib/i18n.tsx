import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'th' | 'en'
const D = {
  th: {
    tagline: 'บ้านสะอาด คนใกล้บ้าน', choose_area: 'บ้านคุณอยู่อำเภอไหน?', choose_area_sub: 'ตอนนี้ให้บริการในจังหวัดชุมพร',
    onb1_t: 'เลือกวันและเวลา', onb1_d: 'ทำความสะอาด 6 ชั่วโมง เลือกเวลาเริ่มได้เอง',
    onb2_t: 'แม่บ้านคนในพื้นที่', onb2_d: 'ตรวจประวัติทุกคน เลือกเองหรือให้เราหาให้',
    onb3_t: 'ปลอดภัย มีประกัน', onb3_d: 'ของเสียหายคุ้มครองสูงสุด 10,000 บาท',
    skip: 'ข้าม', next: 'ถัดไป', start: 'เริ่มใช้งาน', hello: 'สวัสดีค่ะ', guest: 'ผู้มาเยือน',
    login: 'เข้าสู่ระบบ', signup: 'สมัครสมาชิก', logout: 'ออกจากระบบ', email: 'อีเมล', password: 'รหัสผ่าน', full_name: 'ชื่อ-นามสกุล', phone: 'เบอร์โทร (แอดมินเท่านั้นที่เห็น)',
    have_account: 'มีบัญชีแล้ว? เข้าสู่ระบบ', no_account: 'ยังไม่มีบัญชี? สมัครสมาชิก', check_email: 'สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', login_with: 'เข้าสู่ระบบหรือสมัครสมาชิกด้วย', continue_with: 'ดำเนินการต่อด้วย', staff_login: 'ทีมงาน / บัญชีทดสอบ เข้าด้วยอีเมล', login_terms: 'เข้าสู่ระบบครั้งแรก ระบบจะสมัครสมาชิกให้อัตโนมัติ',
    promo_t: 'จองครั้งแรก ลด 100 บาท', promo_d: 'ลดให้อัตโนมัติตอนจ่ายเงิน', services: 'บริการ',
    s_once: 'ทำความสะอาด\nครั้งเดียว', s_monthly: 'แพ็กเกจ\nรายเดือน', s_pick: 'เลือก\nแม่บ้านเอง', s_rebook: 'จอง\nคนเดิมอีก', s_ac: 'ล้างแอร์', s_iron: 'รีดผ้า', soon: 'เร็วๆ นี้',
    my_points: 'แต้มของฉัน', points: 'แต้ม', points_rule: 'ทุก 100 บาทได้ 1 แต้ม ครบ 50 แต้มแลกส่วนลด 100 บาท',
    tab_home: 'หน้าหลัก', tab_bookings: 'การจอง', tab_book: 'จองเลย', tab_msgs: 'ข้อความ', tab_account: 'บัญชี',
    tab_jobs: 'งาน', tab_avail: 'วันว่าง', tab_income: 'รายได้', tab_overview: 'ภาพรวม', tab_money: 'การเงิน', tab_maids: 'แม่บ้าน', tab_settings: 'ตั้งค่า',
    svc_title: 'ทำความสะอาดบ้านทั่วไป', svc_sub: '6 ชั่วโมง 1,500 บาท แม่บ้านนำอุปกรณ์มาเอง',
    ben1: 'จองง่ายใน 1 นาที', ben1d: 'เลือกวัน เวลาเริ่ม และแม่บ้าน แล้วจ่ายเลย', ben2: 'ราคาชัดเจน', ben2d: '1,500 บาทต่อครั้ง ไม่มีค่าใช้จ่ายแอบแฝง',
    ben3: 'แม่บ้านคนในพื้นที่ ตรวจสอบแล้ว', ben3d: 'ยืนยันตัวตนและตรวจประวัติทุกคน', ben4: 'มีประกันความเสียหาย', ben4d: 'คุ้มครองสูงสุด 10,000 บาทต่องาน', book_now: 'เริ่มจองเลย',
    st_maid: 'แม่บ้าน', st_time: 'วันเวลา', st_detail: 'รายละเอียด', st_pay: 'จ่ายเงิน',
    who_cleans: 'ใครจะมาทำความสะอาด?', auto_pick: 'ให้เราหาแม่บ้านให้', auto_pick_d: 'ระบบเลือกคนที่ว่างและรีวิวดีที่สุด', free: 'ฟรี', or_pick: 'หรือเลือกเอง', sorted_reviews: 'เรียงตามรีวิว',
    reviews: 'รีวิว', homes_done: 'บ้านที่ทำแล้ว', view_profile: 'ดูโปรไฟล์และรีวิว', choose: 'เลือก', verified: 'ผ่านการตรวจสอบแล้ว', id_ok: 'ยืนยันตัวตนด้วยบัตรประชาชน', bg_ok: 'ตรวจประวัติอาชญากรรม', no_reviews: 'ยังไม่มีรีวิว',
    pick_date: 'เลือกวันและเวลา', date: 'วันที่', start_time: 'เวลาเริ่มงาน', ends_at: 'ทำงาน 6 ชม. เสร็จประมาณ', no_slots: 'วันนี้ไม่มีเวลาว่าง ลองเลือกวันอื่น',
    once: 'ครั้งเดียว', biweekly: 'ทุก 2 สัปดาห์', weekly: 'ทุกสัปดาห์', pkg_note: 'แพ็กเกจรายเดือนได้แม่บ้านคนเดิมทุกครั้ง ประหยัดสูงสุด 400 บาท', pkg_need_maid: 'แพ็กเกจต้องเลือกแม่บ้านเอง (ไม่มีค่าเลือกเพิ่ม)',
    tell_maid: 'บอกแม่บ้านหน่อย', address: 'ที่อยู่', add_address: 'เพิ่มที่อยู่', change: 'เปลี่ยน', anything: 'มีอะไรที่แม่บ้านควรรู้ไหม',
    tag_pets: 'มีสัตว์เลี้ยง', tag_bath: 'เน้นห้องน้ำ', tag_kitchen: 'เน้นห้องครัว', tag_kids: 'มีเด็กเล็ก', tag_noparking: 'ไม่มีที่จอดรถ',
    note_ph: 'เช่น มีแมว 1 ตัว กุญแจอยู่ที่…', no_contact: 'ห้ามใส่เบอร์โทรหรือไลน์ ระบบจะซ่อนให้อัตโนมัติ คุยกับแม่บ้านผ่านแชทในแอปได้',
    confirm_booking: 'ยืนยันการจอง', clean_6h: 'ทำความสะอาด 6 ชม.', pick_fee: 'เลือกแม่บ้านเอง', first_promo: 'ส่วนลดจองครั้งแรก', use_points: 'ใช้แต้ม', total: 'รวม', baht: 'บาท',
    ins_t: 'คุ้มครองความเสียหายสูงสุด 10,000 บาท', ins_d: 'ถ้าแม่บ้านไม่มา เราหาคนแทน หรือคืนเงินเต็ม', create_and_pay: 'ยืนยันและไปจ่ายเงิน',
    pay_title: 'จ่ายเงิน', scan_pp: 'สแกนจ่ายด้วยพร้อมเพย์', attach_slip: 'แนบสลิปการโอน', slip_sent: 'ส่งสลิปแล้ว รอแอดมินตรวจสอบ', pp_missing: 'ร้านยังไม่ได้ตั้งเลขพร้อมเพย์ กรุณาติดต่อแอดมิน', earn_pts: 'ได้แต้มเพิ่ม',
    cancel_rules: 'ยกเลิกก่อนงาน 24 ชม.ขึ้นไป คืนเต็ม · 6–24 ชม. คืนครึ่งหนึ่ง · น้อยกว่า 6 ชม. ไม่คืนเงิน',
    my_bookings: 'การจองของฉัน', upcoming: 'กำลังจะมาถึง', history: 'ประวัติ', packages: 'แพ็กเกจ', no_bookings: 'ยังไม่มีการจอง', details: 'รายละเอียด', chat: 'แชท',
    s_pending_payment: 'รอจ่ายเงิน', s_payment_review: 'รอตรวจสลิป', s_awaiting_maid: 'กำลังหาแม่บ้าน', s_confirmed: 'แม่บ้านรับงานแล้ว', s_on_the_way: 'กำลังเดินทาง', s_working: 'กำลังทำงาน',
    s_completed: 'เสร็จแล้ว', s_cancelled_by_customer: 'ยกเลิกแล้ว', s_refunded_no_maid: 'คืนเงินแล้ว (ไม่มีแม่บ้าน)', s_payment_rejected: 'สลิปไม่ผ่าน',
    cancel_booking: 'ยกเลิกการจอง', cancel_confirm: 'ยืนยันยกเลิก? คืนเงินตามเงื่อนไข', cancelled_res: 'ยกเลิกแล้ว จะได้รับเงินคืน', arrive_in: 'แม่บ้านกำลังมา', km_away: 'กม. จากบ้านคุณ',
    rate_t: 'ทำเสร็จแล้ว', send_review: 'ส่งรีวิว', review_ph: 'เขียนรีวิวเพิ่ม (ถ้ามี)', thanks_review: 'ขอบคุณสำหรับรีวิว', r_ontime: 'ตรงเวลา', r_clean: 'สะอาดมาก', r_polite: 'สุภาพ', r_detail: 'ละเอียด',
    claim: 'แจ้งของเสียหาย', claim_d: 'ภายใน 3 วันหลังงาน พร้อมรูปถ่าย', claim_item: 'ของที่เสียหาย', claim_price: 'ราคาซื้อ (บาท)', claim_year: 'ปีที่ซื้อ (พ.ศ.)', claim_photos: 'รูปถ่าย', claim_sent: 'ส่งเรื่องแล้ว แอดมินจะติดต่อกลับ',
    type_msg: 'พิมพ์ข้อความ…', send: 'ส่ง', masked_note: 'เบอร์โทรและไลน์จะถูกซ่อนอัตโนมัติ',
    account: 'บัญชี', my_addresses: 'ที่อยู่ของฉัน', no_address: 'ยังไม่มีที่อยู่', addr_ph: 'บ้านเลขที่ ซอย ถนน ตำบล', district: 'อำเภอ', save: 'บันทึก', label: 'ชื่อเรียก', addr_private: 'ที่อยู่จะแสดงให้แม่บ้านเห็น หลังชำระเงินแล้วเท่านั้น',
    favorites: 'แม่บ้านคนโปรด', monthly_pkg: 'แพ็กเกจรายเดือน', pkg_none: 'ยังไม่มี สมัครประหยัด 400 บาท', become_maid: 'สมัครเป็นแม่บ้านกับเรา', language: 'ภาษา',
    m_month: 'เดือนนี้ได้แล้ว', m_pending: 'รอโอนเข้าบัญชี', m_urgent: 'งานแทนด่วน', m_urgent_d: 'แม่บ้านคนเดิมยกเลิก', m_new: 'งานใหม่', m_youget: 'คุณจะได้รับ', m_accept: 'รับงานนี้', m_reject: 'ไม่รับ', m_take: 'รับงานแทน',
    m_my_jobs: 'งานที่รับแล้ว', m_today: 'งานวันนี้', m_start_trip: 'เริ่มเดินทาง', m_arrived: 'ถึงแล้ว เริ่มงาน', m_done: 'เสร็จงาน', m_step1: 'รับงานแล้ว', m_step2: 'เริ่มเดินทาง', m_step2d: 'กดแล้วลูกค้าจะเห็นตำแหน่งของคุณ',
    m_step3: 'ถึงบ้านลูกค้า เริ่มงาน', m_step4: 'เสร็จงาน', m_customer_note: 'ลูกค้าฝากไว้', m_avail: 'วันที่รับงานได้', m_avail_d: 'เปิดวันที่ว่าง แล้วตั้งช่วงเวลา ลูกค้าจะเลือกเวลาเริ่มให้งาน 6 ชม. เสร็จภายในช่วงนี้',
    m_off: 'ไม่รับงาน', m_no_jobs: 'ยังไม่มีงานใหม่', m_cancel_job: 'ยกเลิกงานนี้', m_bank: 'บัญชีรับเงิน', m_apply_t: 'สมัครเป็นแม่บ้าน CleenDee', m_apply_d: 'แอดมินจะตรวจบัตรประชาชนและประวัติก่อนอนุมัติ',
    m_nick: 'ชื่อเล่น', m_bio: 'แนะนำตัวสั้นๆ', m_bank_name: 'ธนาคาร', m_bank_acc: 'เลขบัญชี', m_submit: 'ส่งใบสมัคร', m_wait: 'ส่งใบสมัครแล้ว รอแอดมินอนุมัติ', m_income: 'รายได้', paid_out: 'โอนแล้ว', waiting: 'รอโอน',
    a_title: 'ภาพรวมร้าน', a_income: 'รายได้ของคุณเดือนนี้', a_jobs: 'งาน', a_maids: 'แม่บ้าน', a_todo: 'ต้องจัดการ', a_slips: 'สลิปรอตรวจ', a_unmatched: 'งานที่ยังไม่มีแม่บ้าน', a_unmatched_d: 'ถ้าไม่มีคนรับ คืนเงินเต็ม',
    a_payouts: 'รอโอนให้แม่บ้าน', a_refunds: 'รอคืนเงินลูกค้า', a_claims: 'เรื่องแจ้งของเสียหาย', a_newmaids: 'แม่บ้านสมัครใหม่', approve: 'อนุมัติ', reject: 'ไม่ผ่าน', view_slip: 'ดูสลิป',
    a_mark_paid: 'โอนแล้ว', a_mark_refunded: 'คืนเงินแล้ว', a_refund_full: 'คืนเงินเต็ม', a_split: 'แบ่งเงินต่องาน 1,500 บาท', a_pp: 'เลขพร้อมเพย์ร้าน', a_pp_name: 'ชื่อบัญชี', a_cap: 'วงเงินสูงสุด 10,000 บาท', amount: 'จำนวนเงิน',
    nothing: 'ไม่มีรายการ', saved: 'บันทึกแล้ว', error: 'เกิดข้อผิดพลาด', loading: 'กำลังโหลด…', need_login: 'กรุณาเข้าสู่ระบบก่อนจอง',
  },
  en: {
    tagline: 'Clean home, local helpers', choose_area: 'Which district is your home in?', choose_area_sub: 'We currently serve Chumphon province',
    onb1_t: 'Pick a day and time', onb1_d: '6-hour home cleaning, you choose the start time',
    onb2_t: 'Local housekeepers', onb2_d: 'Background-checked. Choose one or let us match you',
    onb3_t: 'Safe and insured', onb3_d: 'Damage covered up to 10,000 THB',
    skip: 'Skip', next: 'Next', start: 'Get started', hello: 'Hello', guest: 'Guest',
    login: 'Log in', signup: 'Sign up', logout: 'Log out', email: 'Email', password: 'Password', full_name: 'Full name', phone: 'Phone (only admin can see)',
    have_account: 'Have an account? Log in', no_account: 'New here? Sign up', check_email: 'Signed up. Please confirm your email before logging in', login_with: 'Log in or sign up with', continue_with: 'Continue with', staff_login: 'Staff / test accounts: log in with email', login_terms: 'Your account is created automatically the first time you log in',
    promo_t: '100 THB off your first booking', promo_d: 'Applied automatically at checkout', services: 'Services',
    s_once: 'One-time\ncleaning', s_monthly: 'Monthly\npackage', s_pick: 'Choose\nyour helper', s_rebook: 'Book\nagain', s_ac: 'Air-con', s_iron: 'Ironing', soon: 'Soon',
    my_points: 'My points', points: 'pts', points_rule: '1 point per 100 THB · 50 points = 100 THB off',
    tab_home: 'Home', tab_bookings: 'Bookings', tab_book: 'Book', tab_msgs: 'Messages', tab_account: 'Account',
    tab_jobs: 'Jobs', tab_avail: 'Availability', tab_income: 'Income', tab_overview: 'Overview', tab_money: 'Money', tab_maids: 'Helpers', tab_settings: 'Settings',
    svc_title: 'General home cleaning', svc_sub: '6 hours, 1,500 THB, helper brings the supplies',
    ben1: 'Book in 1 minute', ben1d: 'Choose day, start time and helper, then pay', ben2: 'Clear price', ben2d: '1,500 THB per visit, no hidden fees',
    ben3: 'Verified local helpers', ben3d: 'ID verified and background checked', ben4: 'Damage protection', ben4d: 'Up to 10,000 THB per job', book_now: 'Start booking',
    st_maid: 'Helper', st_time: 'Time', st_detail: 'Details', st_pay: 'Payment',
    who_cleans: 'Who will clean?', auto_pick: 'Match me with a helper', auto_pick_d: 'We pick the best-rated helper who is free', free: 'Free', or_pick: 'Or choose', sorted_reviews: 'By rating',
    reviews: 'reviews', homes_done: 'homes cleaned', view_profile: 'View profile and reviews', choose: 'Choose', verified: 'Verified', id_ok: 'ID card verified', bg_ok: 'Criminal background check', no_reviews: 'No reviews yet',
    pick_date: 'Choose date and time', date: 'Date', start_time: 'Start time', ends_at: '6 hours, finishes around', no_slots: 'No free times on this day. Try another day',
    once: 'One-time', biweekly: 'Every 2 weeks', weekly: 'Weekly', pkg_note: 'Monthly packages keep the same helper every visit, save up to 400 THB', pkg_need_maid: 'Packages need a chosen helper (no extra fee)',
    tell_maid: 'Tell your helper', address: 'Address', add_address: 'Add address', change: 'Change', anything: 'Anything your helper should know?',
    tag_pets: 'Pets at home', tag_bath: 'Focus on bathrooms', tag_kitchen: 'Focus on kitchen', tag_kids: 'Small children', tag_noparking: 'No parking',
    note_ph: 'e.g. one friendly cat, key is under…', no_contact: 'Do not add phone numbers or LINE IDs — they are hidden automatically. Chat with your helper in the app',
    confirm_booking: 'Confirm booking', clean_6h: '6-hour cleaning', pick_fee: 'Chosen helper', first_promo: 'First booking discount', use_points: 'Use points', total: 'Total', baht: 'THB',
    ins_t: 'Damage covered up to 10,000 THB', ins_d: 'If the helper does not come, we find another or refund in full', create_and_pay: 'Confirm and pay',
    pay_title: 'Payment', scan_pp: 'Scan to pay with PromptPay', attach_slip: 'Attach transfer slip', slip_sent: 'Slip sent. Waiting for admin check', pp_missing: 'PromptPay is not set up yet. Please contact admin', earn_pts: 'You will earn',
    cancel_rules: '24h+ before: full refund · 6–24h: half refund · under 6h: no refund',
    my_bookings: 'My bookings', upcoming: 'Upcoming', history: 'History', packages: 'Packages', no_bookings: 'No bookings yet', details: 'Details', chat: 'Chat',
    s_pending_payment: 'Awaiting payment', s_payment_review: 'Checking slip', s_awaiting_maid: 'Finding a helper', s_confirmed: 'Helper confirmed', s_on_the_way: 'On the way', s_working: 'Cleaning now',
    s_completed: 'Completed', s_cancelled_by_customer: 'Cancelled', s_refunded_no_maid: 'Refunded (no helper)', s_payment_rejected: 'Slip rejected',
    cancel_booking: 'Cancel booking', cancel_confirm: 'Confirm cancel? Refund follows the policy', cancelled_res: 'Cancelled. Your refund', arrive_in: 'Your helper is on the way', km_away: 'km from your home',
    rate_t: 'is done', send_review: 'Send review', review_ph: 'Write a review (optional)', thanks_review: 'Thanks for your review', r_ontime: 'On time', r_clean: 'Very clean', r_polite: 'Polite', r_detail: 'Thorough',
    claim: 'Report damage', claim_d: 'Within 3 days after the job, with photos', claim_item: 'Damaged item', claim_price: 'Purchase price (THB)', claim_year: 'Year bought', claim_photos: 'Photos', claim_sent: 'Sent. Admin will contact you',
    type_msg: 'Type a message…', send: 'Send', masked_note: 'Phone numbers and LINE IDs are hidden automatically',
    account: 'Account', my_addresses: 'My addresses', no_address: 'No address yet', addr_ph: 'House no., soi, road, subdistrict', district: 'District', save: 'Save', label: 'Label', addr_private: 'Your helper sees the address only after payment',
    favorites: 'Favourite helpers', monthly_pkg: 'Monthly package', pkg_none: 'None yet — save 400 THB', become_maid: 'Work with us as a helper', language: 'Language',
    m_month: 'Earned this month', m_pending: 'To be transferred', m_urgent: 'Urgent replacement', m_urgent_d: 'The original helper cancelled', m_new: 'New job', m_youget: 'You will receive', m_accept: 'Accept job', m_reject: 'Decline', m_take: 'Take this job',
    m_my_jobs: 'My accepted jobs', m_today: 'Today', m_start_trip: 'Start travelling', m_arrived: 'Arrived, start work', m_done: 'Job finished', m_step1: 'Job accepted', m_step2: 'Start travelling', m_step2d: 'The customer will see your location',
    m_step3: 'Arrived, start work', m_step4: 'Job finished', m_customer_note: 'Customer note', m_avail: 'Days I can work', m_avail_d: 'Turn on free days and set hours. Customers pick a start time so the 6-hour job ends within them',
    m_off: 'Off', m_no_jobs: 'No new jobs yet', m_cancel_job: 'Cancel this job', m_bank: 'Payout account', m_apply_t: 'Become a CleenDee helper', m_apply_d: 'Admin checks your ID and background before approval',
    m_nick: 'Nickname', m_bio: 'Short intro', m_bank_name: 'Bank', m_bank_acc: 'Account number', m_submit: 'Submit application', m_wait: 'Application sent. Waiting for approval', m_income: 'Income', paid_out: 'Paid', waiting: 'Pending',
    a_title: 'Shop overview', a_income: 'Your income this month', a_jobs: 'jobs', a_maids: 'helpers', a_todo: 'To do', a_slips: 'Slips to check', a_unmatched: 'Jobs without a helper', a_unmatched_d: 'Refund in full if nobody takes it',
    a_payouts: 'Pay helpers', a_refunds: 'Refund customers', a_claims: 'Damage reports', a_newmaids: 'New helper applications', approve: 'Approve', reject: 'Reject', view_slip: 'View slip',
    a_mark_paid: 'Mark as paid', a_mark_refunded: 'Mark refunded', a_refund_full: 'Refund in full', a_split: 'Split per 1,500 THB job', a_pp: 'Shop PromptPay ID', a_pp_name: 'Account name', a_cap: 'Max 10,000 THB', amount: 'Amount',
    nothing: 'Nothing here', saved: 'Saved', error: 'Something went wrong', loading: 'Loading…', need_login: 'Please log in to book',
  },
} as const
export type Key = keyof typeof D.th

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({ lang: 'th', setLang: () => {}, t: k => k })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorageGet('cd_lang') as Lang) || (navigator.language?.startsWith('th') ? 'th' : 'th'))
  useEffect(() => { localStorageSet('cd_lang', lang); document.documentElement.lang = lang }, [lang])
  const t = (k: Key) => D[lang][k] ?? D.th[k] ?? k
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}
export const useI18n = () => useContext(Ctx)

export function localStorageGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
export function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export function fmtDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', ...opts })
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
}
export const money = (n: number) => n.toLocaleString('en-US')
