// 전역 변수
let salesData = [];
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let weeklyChart = null;
let categoryChart = null;

// 카테고리 매핑 (거래처명에서 추출)
const categories = {
    '맑은이러닝': ['맑은', '이러닝', '맑은이러닝'],
    '콘텐츠': ['콘텐츠'],
    '위캔디오': ['위캔디오', '위캔', '디오']
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updateMonthDisplay();
});

// 이벤트 리스너 초기화
function initializeEventListeners() {
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('shareBtn').addEventListener('click', shareReport);
    document.getElementById('pdfBtn').addEventListener('click', exportToPDF);
}

// 파일 업로드 처리
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            parseExcelData(workbook);
        } catch (error) {
            alert('파일 읽기 오류: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Excel 데이터 파싱
function parseExcelData(workbook) {
    salesData = [];
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 헤더 행 찾기
    let headerRow = 0;
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (row.some(cell => 
            typeof cell === 'string' && 
            (cell.includes('작성일자') || cell.includes('거래일자') || cell.includes('발행일자') || cell.includes('일자'))
        )) {
            headerRow = i;
            break;
        }
    }

    const headers = jsonData[headerRow];
    
    // 컬럼 인덱스 설정 (고정)
    // A열 = 1번째 열 (인덱스 0) - 작성일자
    const dateCol = 0;
    
    // P열 = 16번째 열 (인덱스 15) - 금액
    const amountCol = 15;
    
    // AA열 = 27번째 열 (인덱스 26) - 품목명
    const itemNameCol = 26;

    // 데이터 파싱
    for (let i = headerRow + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const dateStr = row[dateCol];
        const itemName = itemNameCol < row.length ? (row[itemNameCol] || '').toString() : '';
        let amount = amountCol < row.length ? row[amountCol] : null;

        if (!dateStr || !amount) continue;

        // 날짜 파싱
        let date = parseDate(dateStr);
        if (!date) continue;

        // 금액 파싱 (숫자로 변환)
        if (typeof amount === 'string') {
            amount = parseFloat(amount.replace(/[^0-9.-]/g, ''));
        }
        if (isNaN(amount) || amount === 0) continue;

        // 카테고리 결정 (품목명 기반)
        const category = determineCategory(itemName);

        salesData.push({
            date: date,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            week: getWeekOfMonth(date),
            company: itemName, // 품목명을 company로 저장
            itemName: itemName, // 품목명 별도 저장
            category: category,
            amount: amount
        });
    }

    if (salesData.length === 0) {
        alert('데이터를 찾을 수 없습니다.');
        return;
    }

    updateDashboard();
}

// 날짜 파싱
function parseDate(dateStr) {
    if (dateStr instanceof Date) {
        return dateStr;
    }

    const str = dateStr.toString().trim();
    
    // Excel 날짜 숫자 형식 (예: 45234)
    if (!isNaN(str) && str.length > 4) {
        const excelDate = parseInt(str);
        return XLSX.SSF.parse_date_code(excelDate);
    }

    // 일반 날짜 형식
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // YYYY-MM-DD 형식
    const match = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
        return new Date(match[1], match[2] - 1, match[3]);
    }

    return null;
}

// 카테고리 결정 (품목명 또는 거래처명 기반)
function determineCategory(text) {
    if (!text) return '기타';

    const textLower = text.toString().toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => textLower.includes(keyword.toLowerCase()))) {
            return category;
        }
    }

    return '기타';
}

// 월의 주차 계산
function getWeekOfMonth(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfWeek = firstDay.getDay();
    const dayOfMonth = date.getDate();
    
    const weekNumber = Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
    return Math.min(weekNumber, 5); // 최대 5주차
}

// 월 변경
function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    updateMonthDisplay();
    updateDashboard();
}

// 월 표시 업데이트
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = 
        `${currentYear}년 ${currentMonth}월`;
}

// 대시보드 업데이트
function updateDashboard() {
    if (salesData.length === 0) return;

    const monthData = salesData.filter(d => 
        d.year === currentYear && d.month === currentMonth
    );

    if (monthData.length === 0) {
        clearDashboard();
        return;
    }

    // 전월/다음달 데이터
    const prevMonthData = getMonthData(currentYear, currentMonth - 1);
    const nextMonthData = getMonthData(currentYear, currentMonth + 1);

    // 카테고리별 집계
    const categoryTotals = calculateCategoryTotals(monthData);
    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    // 주차별 집계
    const weeklyData = calculateWeeklyData(monthData);

    // UI 업데이트
    updateComparisonCards(prevMonthData, total, nextMonthData);
    updateSummaryCards(categoryTotals, total);
    updateWeeklyChart(weeklyData);
    updateCategoryChart(categoryTotals);
    updateWeeklyTable(weeklyData);
}

// 월별 데이터 가져오기
function getMonthData(year, month) {
    if (month > 12) {
        year++;
        month = 1;
    } else if (month < 1) {
        year--;
        month = 12;
    }

    const monthData = salesData.filter(d => d.year === year && d.month === month);
    return monthData.reduce((sum, d) => sum + d.amount, 0);
}

// 카테고리별 집계
function calculateCategoryTotals(data) {
    const totals = {
        '맑은이러닝': 0,
        '콘텐츠': 0,
        '위캔디오': 0,
        '기타': 0
    };

    data.forEach(item => {
        const category = item.category || '기타';
        totals[category] = (totals[category] || 0) + item.amount;
    });

    return totals;
}

// 주차별 집계
function calculateWeeklyData(data) {
    const weekly = {};

    data.forEach(item => {
        const week = item.week || 1;
        if (!weekly[week]) {
            weekly[week] = {
                '맑은이러닝': 0,
                '콘텐츠': 0,
                '위캔디오': 0,
                '기타': 0
            };
        }
        const category = item.category || '기타';
        weekly[week][category] = (weekly[week][category] || 0) + item.amount;
    });

    return weekly;
}

// 비교 카드 업데이트
function updateComparisonCards(prevTotal, currentTotal, nextTotal) {
    document.getElementById('prevMonthTotal').textContent = formatCurrency(prevTotal);
    document.getElementById('currentMonthTotal').textContent = formatCurrency(currentTotal);
    document.getElementById('nextMonthTotal').textContent = formatCurrency(nextTotal);

    const prevChange = currentTotal > 0 && prevTotal > 0 
        ? ((currentTotal - prevTotal) / prevTotal * 100).toFixed(1)
        : 0;
    const nextChange = nextTotal > 0 && currentTotal > 0
        ? ((nextTotal - currentTotal) / currentTotal * 100).toFixed(1)
        : 0;

    updateChangeElement('prevMonthChange', prevChange);
    updateChangeElement('nextMonthChange', nextChange);
}

function updateChangeElement(id, change) {
    const element = document.getElementById(id);
    if (!element || change === 0) {
        element.textContent = '';
        return;
    }
    element.textContent = change > 0 ? `+${change}%` : `${change}%`;
    element.className = 'change ' + (change > 0 ? 'positive' : 'negative');
}

// 요약 카드 업데이트
function updateSummaryCards(categoryTotals, total) {
    const categories = ['맑은이러닝', '콘텐츠', '위캔디오'];
    
    categories.forEach((category, index) => {
        const amount = categoryTotals[category] || 0;
        const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
        
        document.getElementById(`category${index + 1}Total`).textContent = formatCurrency(amount);
        document.getElementById(`category${index + 1}Percent`).textContent = `${percent}%`;
    });
}

// 주차별 차트 업데이트
function updateWeeklyChart(weeklyData) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    if (weeklyChart) {
        weeklyChart.destroy();
    }

    const weeks = Object.keys(weeklyData).sort((a, b) => a - b);
    const categories = ['맑은이러닝', '콘텐츠', '위캔디오'];

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => `${w}주차`),
            datasets: categories.map((category, index) => ({
                label: category,
                data: weeks.map(w => weeklyData[w][category] || 0),
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(79, 172, 254, 0.8)'
                ][index],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(240, 147, 251, 1)',
                    'rgba(79, 172, 254, 1)'
                ][index],
                borderWidth: 2
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// 카테고리별 차트 업데이트
function updateCategoryChart(categoryTotals) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }

    const categories = ['맑은이러닝', '콘텐츠', '위캔디오'];
    const amounts = categories.map(cat => categoryTotals[cat] || 0);

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(79, 172, 254, 0.8)'
                ],
                borderColor: [
                    'rgba(102, 126, 234, 1)',
                    'rgba(240, 147, 251, 1)',
                    'rgba(79, 172, 254, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = amounts.reduce((a, b) => a + b, 0);
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${formatCurrency(value)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 주차별 테이블 업데이트
function updateWeeklyTable(weeklyData) {
    const tbody = document.getElementById('weeklyTableBody');
    tbody.innerHTML = '';

    const weeks = Object.keys(weeklyData).sort((a, b) => a - b);
    const categories = ['맑은이러닝', '콘텐츠', '위캔디오'];

    if (weeks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">데이터가 없습니다</td></tr>';
        return;
    }

    weeks.forEach(week => {
        const row = document.createElement('tr');
        const weekData = weeklyData[week];
        const total = categories.reduce((sum, cat) => sum + (weekData[cat] || 0), 0);

        row.innerHTML = `
            <td><strong>${week}주차</strong></td>
            <td>${formatCurrency(weekData['맑은이러닝'] || 0)}</td>
            <td>${formatCurrency(weekData['콘텐츠'] || 0)}</td>
            <td>${formatCurrency(weekData['위캔디오'] || 0)}</td>
            <td><strong>${formatCurrency(total)}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

// 대시보드 초기화
function clearDashboard() {
    document.getElementById('prevMonthTotal').textContent = '-';
    document.getElementById('currentMonthTotal').textContent = '-';
    document.getElementById('nextMonthTotal').textContent = '-';
    
    ['category1', 'category2', 'category3'].forEach(id => {
        document.getElementById(id + 'Total').textContent = '₩0';
        document.getElementById(id + 'Percent').textContent = '0%';
    });

    document.getElementById('weeklyTableBody').innerHTML = 
        '<tr><td colspan="5" class="no-data">데이터가 없습니다</td></tr>';

    if (weeklyChart) {
        weeklyChart.destroy();
        weeklyChart = null;
    }
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
}

// 통화 포맷
function formatCurrency(amount) {
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
}

// 링크 공유
function shareReport() {
    const reportText = document.getElementById('reportText').value;
    const monthText = `${currentYear}년 ${currentMonth}월`;
    
    const data = {
        month: monthText,
        salesData: salesData.filter(d => 
            d.year === currentYear && d.month === currentMonth
        ),
        reportText: reportText,
        currentMonth: currentMonth,
        currentYear: currentYear
    };

    const encoded = btoa(JSON.stringify(data));
    const url = window.location.href.split('?')[0] + '?data=' + encoded;
    
    navigator.clipboard.writeText(url).then(() => {
        alert('링크가 클립보드에 복사되었습니다!');
    }).catch(() => {
        prompt('다음 링크를 복사하세요:', url);
    });
}

// PDF 출력
async function exportToPDF() {
    const monthText = `${currentYear}년 ${currentMonth}월`;
    const reportText = document.getElementById('reportText').value;
    
    // PDF용 HTML 생성
    const monthData = salesData.filter(d => 
        d.year === currentYear && d.month === currentMonth
    );
    const categoryTotals = calculateCategoryTotals(monthData);
    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    
    let pdfHTML = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
                    padding: 40px;
                    color: #333;
                }
                h1 {
                    text-align: center;
                    font-size: 24px;
                    margin-bottom: 10px;
                    color: #667eea;
                }
                h2 {
                    text-align: center;
                    font-size: 18px;
                    margin-bottom: 30px;
                    color: #666;
                }
                .section {
                    margin-bottom: 30px;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 5px;
                }
                .category-item {
                    margin: 10px 0;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 5px;
                }
                .category-item strong {
                    color: #667eea;
                }
                .total {
                    margin-top: 15px;
                    padding: 15px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: bold;
                    text-align: center;
                }
                .report-content {
                    margin-top: 20px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    white-space: pre-wrap;
                    line-height: 1.6;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                th, td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }
                th {
                    background: #667eea;
                    color: white;
                }
                tr:hover {
                    background: #f5f5f5;
                }
            </style>
        </head>
        <body>
            <h1>📊 매출 통계 보고서</h1>
            <h2>${monthText}</h2>
            
            <div class="section">
                <div class="section-title">카테고리별 매출</div>
                <div class="category-item">
                    <strong>맑은이러닝:</strong> ${formatCurrency(categoryTotals['맑은이러닝'] || 0)} 
                    (${total > 0 ? ((categoryTotals['맑은이러닝'] || 0) / total * 100).toFixed(1) : 0}%)
                </div>
                <div class="category-item">
                    <strong>콘텐츠:</strong> ${formatCurrency(categoryTotals['콘텐츠'] || 0)} 
                    (${total > 0 ? ((categoryTotals['콘텐츠'] || 0) / total * 100).toFixed(1) : 0}%)
                </div>
                <div class="category-item">
                    <strong>위캔디오:</strong> ${formatCurrency(categoryTotals['위캔디오'] || 0)} 
                    (${total > 0 ? ((categoryTotals['위캔디오'] || 0) / total * 100).toFixed(1) : 0}%)
                </div>
                <div class="total">합계: ${formatCurrency(total)}</div>
            </div>
    `;
    
    // 주차별 상세 테이블 추가
    const weeklyData = calculateWeeklyData(monthData);
    const weeks = Object.keys(weeklyData).sort((a, b) => a - b);
    if (weeks.length > 0) {
        pdfHTML += `
            <div class="section">
                <div class="section-title">주차별 상세 내역</div>
                <table>
                    <thead>
                        <tr>
                            <th>주차</th>
                            <th>맑은이러닝</th>
                            <th>콘텐츠</th>
                            <th>위캔디오</th>
                            <th>합계</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        weeks.forEach(week => {
            const weekData = weeklyData[week];
            const weekTotal = (weekData['맑은이러닝'] || 0) + (weekData['콘텐츠'] || 0) + (weekData['위캔디오'] || 0);
            pdfHTML += `
                        <tr>
                            <td><strong>${week}주차</strong></td>
                            <td>${formatCurrency(weekData['맑은이러닝'] || 0)}</td>
                            <td>${formatCurrency(weekData['콘텐츠'] || 0)}</td>
                            <td>${formatCurrency(weekData['위캔디오'] || 0)}</td>
                            <td><strong>${formatCurrency(weekTotal)}</strong></td>
                        </tr>
            `;
        });
        pdfHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // 보고서 내용 추가
    if (reportText) {
        pdfHTML += `
            <div class="section">
                <div class="section-title">보고 내용</div>
                <div class="report-content">${reportText.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }
    
    pdfHTML += `
        </body>
        </html>
    `;
    
    // 임시 div 생성
    const printWindow = document.createElement('div');
    printWindow.innerHTML = pdfHTML;
    printWindow.style.position = 'absolute';
    printWindow.style.left = '-9999px';
    document.body.appendChild(printWindow);
    
    // PDF 생성 옵션
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `매출통계_${currentYear}년${currentMonth}월.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            letterRendering: true
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        }
    };
    
    try {
        await html2pdf().set(opt).from(printWindow).save();
        document.body.removeChild(printWindow);
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        alert('PDF 생성 중 오류가 발생했습니다.');
        document.body.removeChild(printWindow);
    }
}

// URL 파라미터에서 데이터 로드
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
        try {
            const data = JSON.parse(atob(dataParam));
            if (data.currentMonth && data.currentYear) {
                currentMonth = data.currentMonth;
                currentYear = data.currentYear;
                updateMonthDisplay();
            }
            if (data.reportText) {
                document.getElementById('reportText').value = data.reportText;
            }
            if (data.salesData && salesData.length > 0) {
                updateDashboard();
            }
        } catch (e) {
            console.error('데이터 로드 오류:', e);
        }
    }
});

