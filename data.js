/* Dữ liệu cố định: mục chi mặc định, thực đơn, danh sách đi chợ, nguồn đồ ăn free.
   Tách riêng để sau này mỗi người có thể thay nội dung của mình mà không đụng vào logic. */
// color: c1–c8 là 8 ô màu trong bảng màu (xem --c1… trong index.html); budget là ngân sách của kỳ đầu tiên.
const DEFAULT_CATS = [
  { id: "groceries", color: "c1", name: "Đi chợ", budget: 460, kind: "plan", note: "Costco + Cermak theo danh sách" },
  { id: "eatout", color: "c2", name: "Ăn ngoài", budget: 80, kind: "flex", note: "Khoảng 1 bữa mỗi tuần" },
  { id: "utilities", color: "c3", name: "Wifi + điện", budget: 150, kind: "fixed", note: "$50 × 3 tháng" },
  { id: "haircut", color: "c4", name: "Cắt tóc", budget: 90, kind: "fixed", note: "$30 × 3 tháng" },
  { id: "claude", color: "c5", name: "Claude", budget: 60, kind: "fixed", note: "$20 × 3 tháng" },
  { id: "misc", color: "c6", name: "Linh tinh", budget: 60, kind: "flex", note: "Đồ dùng, quà nhỏ" },
  { id: "buffer", color: "c7", name: "Dự phòng", budget: 100, kind: "reserve", note: "Chỉ dùng khi gấp" }
];
// Ảnh dán bên phải màn hình máy tính (màn hình hẹp và điện thoại thì ẩn).
// Khóa là tên mục: log = Chi tiêu, cook = Nấu gì, shop = Đi chợ, free = Săn free, settings = Cài đặt.
// Muốn riêng cho một mục con thì ghi "mục/mục con", ví dụ "log/budget", "free/where", "home/rules".
// Bỏ dòng nào thì mục đó không có ảnh. Ảnh đặt trong thư mục img/.
const CHEER = { src: "img/cheer.jpg", alt: "Cô gái anime cầm bông cổ vũ", caption: "Cố lên, giữ lửa nha!", sub: "Mỗi đồng giữ lại là một ngày lửa cháy" };
const STICKERS = {
  "home/rules": CHEER,
  log: CHEER,
  cook: CHEER,
  shop: CHEER,
  free: CHEER,
  settings: CHEER
};

const KIND_LABEL = { plan: "trong plan", flex: "ngoài plan", fixed: "cố định", reserve: "dự phòng" };
const CHIPS = { eatout: [6, 10, 14], groceries: [20, 25, 45], misc: [5, 10, 20], buffer: [20, 50] };

// Thực đơn 4 tuần xoay vòng. kcal/đạm: ước tính cho 1 phần.
const MENU = [
  { title: "Tuần gà và trứng", days: [
    { n: "Gà kho gừng", s: "Cơm + cải thìa luộc", t: 35, tool: "Bếp ga", k: 650, p: 38, steps: ["Ướp 1 lb đùi gà với nước mắm, đường, tiêu 10 phút.", "Phi gừng tỏi, cho gà vào xào săn.", "Thêm nửa chén nước, kho lửa nhỏ 20 phút đến khi sệt.", "Luộc cải thìa trong lúc chờ."] },
    { n: "Thịt kho trứng", s: "Cơm + dưa leo hoặc rau luộc", t: 60, tool: "Bếp ga", k: 700, p: 40, steps: ["Luộc 4 trứng, bóc vỏ.", "Thịt vai 1 lb cắt miếng, ướp nước mắm đường tỏi 15 phút.", "Thắng đường cho thịt vào đảo, đổ nước ngập, cho trứng vào.", "Kho lửa nhỏ 40 phút; trong lúc đó làm việc khác."] },
    { n: "Cơm chiên trứng rau củ", s: "Dùng cơm nguội", t: 15, tool: "Bếp ga", k: 600, p: 22, steps: ["Đánh 3 trứng, chiên sơ, để riêng.", "Xào 1,5 chén rau củ đông lạnh với tỏi.", "Cho 2 chén cơm nguội vào đảo tơi, nêm xì dầu.", "Trộn trứng vào, tắt bếp."] },
    { n: "Đùi gà nướng sả + khoai tây", s: "Bắp cải trộn giấm", t: 30, tool: "Nồi chiên không dầu", k: 680, p: 36, steps: ["Ướp 1 lb đùi gà với sả băm, nước mắm, dầu ăn.", "Khoai tây cắt múi, trộn dầu muối.", "Nồi chiên 200°C khoảng 20 phút, lật giữa chừng.", "Bào bắp cải trộn giấm đường."] },
    { n: "Đậu hũ sốt cà chua thịt băm", s: "Cơm + rau cải luộc", t: 25, tool: "Bếp ga", k: 620, p: 32, steps: ["Đậu hũ cắt miếng, chiên vàng (hoặc nồi chiên 12 phút).", "Xào 1/2 lb thịt băm với hành tỏi.", "Cho 3 quả cà chua cắt nhỏ, nêm, đun tới khi nhừ.", "Cho đậu vào rim 5 phút."] },
    { n: "Mì xào gà cải", s: "Mì trứng khô", t: 20, tool: "Bếp ga", k: 650, p: 33, steps: ["Trụng 200 g mì trứng, xả nước lạnh.", "Xào 1/2 lb gà thái mỏng tới chín.", "Cho cải và mì vào, nêm xì dầu, dầu hào nếu có.", "Đảo đều 2 phút."] },
    { n: "Canh bắp cải thịt băm + trứng chiên", s: "Nấu thêm nồi cơm cho đầu tuần", t: 25, tool: "Bếp ga + nồi cơm", k: 580, p: 34, steps: ["Xào sơ 1/2 lb thịt băm, đổ nước sôi.", "Cho 1/4 bắp cải thái vào, nêm nước mắm.", "Chiên 3 trứng với hành.", "Nấu nồi cơm lớn, chia hộp cất tủ lạnh."] }
  ]},
  { title: "Tuần heo và cá", days: [
    { n: "Cá basa kho tiêu", s: "Cơm + canh cải", t: 30, tool: "Bếp ga", k: 560, p: 34, steps: ["1 lb phi lê basa cắt khúc, ướp nước mắm đường tiêu.", "Thắng nước màu, cho cá vào, thêm ít nước.", "Kho lửa nhỏ 15 phút, rắc nhiều tiêu.", "Nấu canh cải với chút tôm khô hoặc hành."] },
    { n: "Thịt heo rim mặn ngọt", s: "Dưa leo + cà chua", t: 30, tool: "Bếp ga", k: 680, p: 36, steps: ["Thịt vai 1 lb thái mỏng, ướp nước mắm đường tỏi.", "Xào săn rồi rim lửa nhỏ tới khi thịt bóng.", "Cắt dưa leo cà chua ăn kèm."] },
    { n: "Gà xào sả ớt", s: "Cơm + bông cải đông lạnh", t: 25, tool: "Bếp ga", k: 620, p: 38, steps: ["1 lb gà cắt miếng nhỏ, ướp sả ớt nước mắm.", "Xào lửa lớn tới khi vàng.", "Hấp hoặc xào bông cải đông lạnh với tỏi."] },
    { n: "Trứng hấp thịt băm", s: "Hấp chung trong nồi cơm + canh rau", t: 25, tool: "Nồi cơm điện", k: 560, p: 30, steps: ["Trộn 4 trứng với 1/2 lb thịt băm, hành, nước mắm.", "Đổ vào chén, đặt lên xửng nồi cơm khi nấu cơm.", "Cơm chín là trứng chín.", "Nấu canh rau đơn giản."] },
    { n: "Cá basa chiên giòn", s: "Nước mắm tỏi ớt + rau sống", t: 20, tool: "Nồi chiên không dầu", k: 540, p: 33, steps: ["1 lb cá thấm khô, rắc muối tiêu, phết dầu.", "Nồi chiên 200°C 12–15 phút.", "Pha nước mắm tỏi ớt chanh.", "Ăn với dưa leo, cà chua."] },
    { n: "Cà ri gà khoai tây cà rốt", s: "Nấu nồi lớn, ăn với cơm hoặc bánh mì", t: 45, tool: "Bếp ga", k: 720, p: 35, steps: ["Xào 1 lb gà với hành tỏi và gói bột cà ri.", "Cho 2 khoai tây và 1 cà rốt cắt khúc.", "Đổ nước ngập, nấu 25 phút, cuối cho hộp nước cốt dừa nhỏ."] },
    { n: "Cơm chiên dọn tủ lạnh", s: "Trứng + rau thịt còn dư", t: 15, tool: "Bếp ga", k: 600, p: 24, steps: ["Gom rau và thịt còn dư trong tuần, cắt nhỏ.", "Chiên với cơm nguội và 2–3 trứng.", "Nêm xì dầu, tiêu."] }
  ]},
  { title: "Tuần đậu và thịt băm", days: [
    { n: "Thịt băm rim cà chua + trứng luộc", s: "Cải luộc", t: 25, tool: "Bếp ga", k: 620, p: 36, steps: ["Xào 1/2 lb thịt băm với hành tỏi.", "Cho 2 quả cà chua, nêm nước mắm, rim sệt.", "Luộc 2 trứng và rau."] },
    { n: "Gà nướng mật ong tỏi", s: "Khoai lang nướng chung", t: 45, tool: "Lò nướng", k: 690, p: 37, steps: ["Ướp 1 lb đùi gà với xì dầu, mật ong (hoặc đường), tỏi.", "Khoai lang cắt khúc đặt chung khay.", "Nướng 200°C khoảng 30 phút."] },
    { n: "Canh chua cá basa", s: "Cơm", t: 30, tool: "Bếp ga", k: 520, p: 32, steps: ["Đun nước với cà chua và thơm hộp.", "Cho cá basa vào nấu 8 phút.", "Nêm nước mắm, đường, chút me hoặc chanh.", "Cuối cho giá và rau thơm."] },
    { n: "Đậu hũ nhồi thịt sốt cà", s: "Cơm + rau", t: 35, tool: "Bếp ga", k: 640, p: 34, steps: ["Đậu hũ cắt khối, khoét nhẹ, nhồi thịt băm ướp.", "Chiên vàng mặt thịt.", "Sốt cà chua, cho đậu vào rim 10 phút."] },
    { n: "Bún gà nhanh", s: "Bún khô + hành ngò", t: 35, tool: "Bếp ga", k: 600, p: 35, steps: ["Luộc 1/2 lb gà với gừng hành 20 phút, vớt ra xé.", "Nêm nước luộc làm nước dùng.", "Trụng bún, chan nước, thêm gà và hành."] },
    { n: "Thịt heo xào bắp cải cà rốt", s: "Cơm", t: 20, tool: "Bếp ga", k: 610, p: 30, steps: ["Xào 1/2 lb thịt thái mỏng tới chín.", "Cho bắp cải và cà rốt thái sợi.", "Nêm xì dầu, đảo lửa lớn 3 phút."] },
    { n: "Trứng chiên thịt băm hành", s: "Canh rau + nấu cơm cho tuần sau", t: 20, tool: "Bếp ga + nồi cơm", k: 590, p: 30, steps: ["Trộn 3 trứng với 1/4 lb thịt băm và hành.", "Chiên lửa vừa hai mặt.", "Nấu canh rau và nồi cơm lớn."] }
  ]},
  { title: "Tuần ấm bụng", days: [
    { n: "Cháo gà gừng", s: "Nồi cơm điện chế độ cháo", t: 60, tool: "Nồi cơm điện", k: 520, p: 32, steps: ["Vo 1 chén gạo, cho vào nồi với 6–7 chén nước.", "Cho 1/2 lb gà và vài lát gừng.", "Bật chế độ cháo, để máy tự nấu.", "Xé gà, nêm, thêm hành tiêu."] },
    { n: "Sườn non rim", s: "Rau luộc", t: 45, tool: "Bếp ga", k: 720, p: 38, steps: ["1,5 lb sườn chặt miếng, chần sơ.", "Ướp nước mắm đường tỏi.", "Rim lửa nhỏ 30 phút tới khi sệt."] },
    { n: "Gà rô ti", s: "Bắp cải xào tỏi", t: 30, tool: "Nồi chiên không dầu", k: 670, p: 37, steps: ["Ướp 1 lb đùi gà với xì dầu, đường, tỏi.", "Nồi chiên 190°C 18–20 phút.", "Xào bắp cải với tỏi."] },
    { n: "Canh bắp cải cuộn thịt", s: "Cơm", t: 40, tool: "Bếp ga", k: 580, p: 30, steps: ["Trụng lá bắp cải cho mềm.", "Cuộn 1/2 lb thịt băm ướp, buộc bằng cọng hành.", "Thả vào nồi nước sôi nấu 15 phút, nêm."] },
    { n: "Mì ramen trứng thịt heo", s: "Kiểu lẩu nhỏ một người", t: 20, tool: "Bếp ga", k: 650, p: 32, steps: ["Đun nước dùng từ gói gia vị hoặc xương gà.", "Thả thịt heo thái mỏng, cải và mì.", "Đập 2 trứng vào nồi, tắt bếp."] },
    { n: "Đậu hũ chiên sả ớt", s: "Rau xào", t: 25, tool: "Nồi chiên không dầu", k: 560, p: 26, steps: ["Đậu hũ cắt khối, trộn sả ớt muối và chút dầu.", "Nồi chiên 200°C 15 phút.", "Xào một đĩa rau với tỏi."] },
    { n: "Cơm trộn kiểu Hàn", s: "Dọn rau dư + trứng ốp la", t: 15, tool: "Bếp ga", k: 600, p: 24, steps: ["Xào nhanh rau dư trong tuần.", "Ốp la 2 trứng.", "Trộn với cơm, xì dầu, tương ớt, mè nếu có."] }
  ]}
];

// Danh sách Cermak theo tuần xoay vòng (giá ước tính, USD)
const CERMAK = [
  [ ["thit-vai","Thịt vai heo","1 lb",4],["thit-bam","Thịt heo băm","1 lb",4],["dau-hu","Đậu hũ","1 hộp",2],["cai-thia","Cải thìa","1 lb",2],["bap-cai","Bắp cải","1 cái",2],["ca-chua","Cà chua","1 lb",2],["khoai-tay","Khoai tây","3 lb",3],["mi-trung","Mì trứng khô","1 gói",2],["chuoi","Chuối","1 nải",1.5] ],
  [ ["ca-basa","Phi lê cá basa","2 lb",7],["thit-vai","Thịt vai heo","1 lb",4],["thit-bam","Thịt heo băm","1/2 lb",2],["cai","Rau cải","1 lb",2],["dua-ca","Dưa leo + cà chua","",2.5],["ca-rot","Cà rốt","1 lb",1],["ca-ri","Gói cà ri + nước cốt dừa nhỏ","",3],["chuoi","Chuối","1 nải",1.5] ],
  [ ["thit-bam","Thịt heo băm","1,25 lb",5],["thit-vai","Thịt vai heo","1/2 lb",2],["ca-basa","Phi lê cá basa","1 lb",3.5],["dau-hu","Đậu hũ","1 hộp",2],["khoai-lang","Khoai lang","2 lb",2.5],["ca-chua","Cà chua","1,5 lb",3],["gia-thom","Giá + thơm hộp","",2.5],["bun","Bún khô","1 gói",2],["chuoi","Chuối","1 nải",1.5] ],
  [ ["suon","Sườn non heo","1,5 lb",6],["thit-vai","Thịt vai heo","1/2 lb",2],["thit-bam","Thịt heo băm","1/2 lb",2],["dau-hu","Đậu hũ","1 hộp",2],["bap-cai","Bắp cải","1 cái",2],["cai","Rau cải","1 lb",2],["ramen","Mì ramen","1 gói",2],["gung-hanh","Gừng + hành","",1.5],["chuoi","Chuối","1 nải",1.5] ]
];
const PANTRY = [ ["nuoc-mam","Nước mắm","1 chai",3],["xi-dau","Xì dầu","1 chai",2.5],["dau-an","Dầu ăn","1 chai",4],["duong","Đường","1 túi",2],["toi-sa-ot","Tỏi + sả + ớt","",3],["tieu","Tiêu","1 lọ",1.5] ];
const COSTCO = [
  { id: "c1", label: "Đơn Costco đợt 1", due: "2026-10-15", items: [ ["gao","Gạo jasmine","25 lb, dùng hết kỳ",22],["trung","Trứng","5 tá (60 quả), dùng ~6 tuần",15],["dui-ga","Đùi gà không xương","~6 lb",25],["rau-dong","Rau củ đông lạnh","~5 lb",10],["phi","Phí giao + chênh giá","ước tính",12] ] },
  { id: "c2", label: "Đơn Costco đợt 2", due: "2026-11-12", items: [ ["dui-ga","Đùi gà không xương","~6 lb",25],["rau-dong","Rau củ đông lạnh","~5 lb",10],["phi","Phí giao + chênh giá","ước tính",8] ] },
  { id: "c3", label: "Đơn Costco đợt 3", due: "2026-12-10", items: [ ["trung","Trứng","5 tá",15],["dui-ga","Đùi gà không xương","~6 lb",25],["rau-dong","Rau củ đông lạnh","~5 lb",10],["phi","Phí giao + chênh giá","ước tính",8] ] }
];

const FREE_SRC = [
  { id: "club", name: "Sự kiện CLB và info session", saved: 6,
    k: "Thường có pizza hoặc đồ ăn nhẹ, nhất là buổi họp đầu kỳ, workshop và buổi giới thiệu công ty.",
    how: "Mở UIC Connection, xem tab Events và tìm các chữ food, pizza, snacks, refreshments trong mô tả.",
    links: [["UIC Connection: Events", "https://uic.campusgroups.com/events"], ["Lịch sự kiện UIC Today", "https://today.uic.edu/events/"]] },
  { id: "pantry", name: "UIC Pop-Up Pantry", saved: 15,
    k: "Wellness Center, 750 S Halsted St, Suite 238. Theo trang của UIC: thứ Tư và thứ Năm 1–4 giờ chiều trong học kỳ.",
    how: "Đăng ký trước ở quầy Wellness Center (ngoài giờ pantry), mang I-card. Tối đa 2 lần/tháng. Pantry dành cho sinh viên đang thiếu bữa vì khó khăn tài chính nghiêm trọng, nên chỉ dùng khi bạn thực sự cần. Hỏi giờ hiện tại: (312) 413-2120.",
    links: [["Trang Pop-Up Pantry", "https://wellnesscenter.uic.edu/resources-and-services/pop-up-pantry/pop-up-pantry-2/"]] },
  { id: "tgtg", name: "App Too Good To Go", saved: 8,
    k: "Mua túi đồ ăn quán không bán hết trong ngày, thường khoảng $4–6 mà giá trị gấp mấy lần.",
    how: "Tải app, đặt vị trí gần 60616, lọc tiệm bánh và quán ăn ở Chinatown/South Loop, đặt trước và lấy vào cuối ngày. Không chọn được món bên trong.",
    links: [["Too Good To Go", "https://www.toogoodtogo.com/en-us"]] },
  { id: "other", name: "Khác", saved: 6, k: "", how: "", links: [] }
];
const SALE_SRC = [
  { name: "Cermak Fresh Market", k: "Xem tờ khuyến mãi tuần ngay ở cửa vào. Thịt, rau nào đang giảm thì đổi món trong thực đơn tuần cho khớp, ví dụ thay thịt vai bằng loại thịt đang sale." },
  { name: "Costco", k: "Kiểm tra mục khuyến mãi trong app trước khi đặt; xem giá giảm trong sách coupon có áp dụng cho đơn giao không." },
  { name: "Happy hour có đồ ăn", k: "Nhiều quán ở Loop và South Loop có happy hour giảm giá đồ ăn; bạn có thể gọi nước không cồn và vẫn được giá ưu đãi." },
  { name: "Giảm giá sinh viên", k: "Hỏi thẳng quán quen có giảm giá cho sinh viên khi đưa I-card không; nhiều quán gần trường có nhưng không ghi ra." }
];
