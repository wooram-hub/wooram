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

// Base64 인코딩 (한글 지원)
function encodeBase64(str) {
    try {
        // UTF-8로 인코딩 후 Base64 변환
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        // 실패 시 encodeURIComponent 사용
        return encodeURIComponent(str);
    }
}

// 링크 공유
function shareReport() {
    try {
        const reportText = document.getElementById('reportText')?.value || '';
        const monthText = `${currentYear}년 ${currentMonth}월`;
        
        // 월별 데이터 필터링
        const monthData = salesData.filter(d => 
            d.year === currentYear && d.month === currentMonth
        );
        
        if (monthData.length === 0) {
            alert('공유할 데이터가 없습니다.');
            return;
        }
        
        // 항상 전체 데이터 포함 (최대한 압축)
        const dataToShare = {
            month: monthText,
            salesData: monthData.map(d => ({
                date: d.date.toISOString().split('T')[0],
                category: d.category,
                amount: d.amount,
                itemName: d.itemName || d.company || ''
            })),
            reportText: reportText,
            currentMonth: currentMonth,
            currentYear: currentYear
        };

        // JSON 문자열화
        let jsonString;
        try {
            jsonString = JSON.stringify(dataToShare);
        } catch (e) {
            throw new Error('데이터를 변환하는 중 오류가 발생했습니다.');
        }

        // Base64 인코딩
        let encoded;
        try {
            encoded = encodeBase64(jsonString);
        } catch (e) {
            throw new Error('링크 인코딩 중 오류가 발생했습니다.');
        }

        const baseUrl = window.location.href.split('?')[0];
        const url = baseUrl + '?data=' + encoded;
        
        // URL 길이 체크 (일반적으로 브라우저는 2048자 제한)
        if (url.length > 2000) {
            // URL이 너무 길면 경고 표시하고 계속 진행 (전체 데이터 포함)
            if (!confirm(`링크가 ${url.length}자로 매우 깁니다.\n일부 브라우저에서 문제가 발생할 수 있습니다.\n그래도 계속하시겠습니까?`)) {
                return;
            }
        }
        
        console.log('링크 생성 완료:', url.substring(0, 100) + '...');
        
        // Web Share API 지원 여부 확인
        if (navigator.share && typeof navigator.share === 'function') {
            navigator.share({
                title: `매출 통계 보고서 - ${monthText}`,
                text: `매출 통계 보고서를 공유합니다: ${monthText}`,
                url: url
            }).catch((error) => {
                // 사용자가 취소하거나 오류 발생 시 모달 표시
                if (error.name !== 'AbortError') {
                    console.log('공유 오류:', error);
                }
                showShareModal(url, monthText);
            });
        } else {
            // Web Share API를 지원하지 않는 경우 모달 표시
            showShareModal(url, monthText);
        }
    } catch (error) {
        console.error('링크 공유 오류:', error);
        alert('링크 생성 중 오류가 발생했습니다.\n\n오류: ' + (error.message || error.toString()) + '\n\n콘솔을 확인해주세요.');
    }
}

// 링크 공유 모달 표시
function showShareModal(url, monthText) {
    console.log('모달 표시 시작:', url);
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('shareModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 모달 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'shareModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; justify-content: center !important; align-items: center !important; z-index: 99999 !important;';
    
    // 모달 콘텐츠 생성
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = 'background: white !important; border-radius: 15px !important; width: 90% !important; max-width: 500px !important; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;';
    
    content.innerHTML = `
        <div class="modal-header">
            <h2>🔗 링크 공유</h2>
            <button class="modal-close" id="modalCloseBtn">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 15px; color: #666;">
                <strong>${monthText}</strong> 매출 통계 보고서를 공유할 수 있는 링크입니다.
            </p>
            <div class="share-url-container">
                <input type="text" id="shareUrlInput" value="${url}" readonly class="share-url-input">
                <button id="copyUrlBtn" class="btn-copy">복사</button>
            </div>
            <div id="copySuccess" class="copy-success" style="display: none;">
                ✓ 링크가 클립보드에 복사되었습니다!
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" id="copyUrlBtn2">링크 복사</button>
            <button class="btn btn-secondary" id="closeModalBtn">닫기</button>
        </div>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    console.log('모달 DOM 추가 완료');
    
    // 이벤트 리스너 추가
    setTimeout(() => {
        const closeBtn = document.getElementById('modalCloseBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const copyBtn = document.getElementById('copyUrlBtn');
        const copyBtn2 = document.getElementById('copyUrlBtn2');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeShareModal);
        }
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeShareModal);
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', copyShareUrl);
        }
        if (copyBtn2) {
            copyBtn2.addEventListener('click', copyShareUrl);
        }
        
        // 오버레이 클릭 시 모달 닫기
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeShareModal();
            }
        });
        
        // URL 입력 필드 자동 선택
        const urlInput = document.getElementById('shareUrlInput');
        if (urlInput) {
            urlInput.select();
            urlInput.focus();
        }
    }, 50);
}

// 링크 복사
function copyShareUrl() {
    const urlInput = document.getElementById('shareUrlInput');
    if (!urlInput) return;
    
    urlInput.select();
    urlInput.setSelectionRange(0, 99999); // 모바일 지원
    
    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        // execCommand 실패 시 Clipboard API 시도
        navigator.clipboard.writeText(urlInput.value).then(() => {
            showCopySuccess();
        }).catch(() => {
            alert('링크 복사에 실패했습니다. 수동으로 복사해주세요.');
        });
    }
}

// 복사 성공 메시지 표시
function showCopySuccess() {
    const successMsg = document.getElementById('copySuccess');
    if (successMsg) {
        successMsg.style.display = 'block';
        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 3000);
    }
}

// 모달 닫기
function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.remove();
        console.log('모달 닫기 완료');
    }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeShareModal();
    }
});

// PDF 출력
async function exportToPDF() {
    if (typeof html2canvas === 'undefined') {
        alert('PDF 생성 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    const monthText = `${currentYear}년 ${currentMonth}월`;
    const reportText = document.getElementById('reportText').value;
    
    // 데이터 확인
    const monthData = salesData.filter(d => 
        d.year === currentYear && d.month === currentMonth
    );
    
    if (monthData.length === 0) {
        alert('표시할 데이터가 없습니다. 파일을 업로드해주세요.');
        return;
    }

    const categoryTotals = calculateCategoryTotals(monthData);
    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    
    // PDF용 컨테이너 생성
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'fixed';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '0';
    pdfContainer.style.width = '210mm';
    pdfContainer.style.padding = '20mm';
    pdfContainer.style.background = 'white';
    pdfContainer.style.fontFamily = "'Malgun Gothic', '맑은 고딕', Arial, sans-serif";
    pdfContainer.style.color = '#333';
    pdfContainer.style.fontSize = '12px';
    
    pdfContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 24px; color: #667eea; margin-bottom: 10px;">매출 통계 보고서</h1>
            <h2 style="font-size: 18px; color: #666;">${monthText}</h2>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">카테고리별 매출</h3>
            <div style="margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 5px;">
                <strong style="color: #667eea;">맑은이러닝:</strong> ${formatCurrency(categoryTotals['맑은이러닝'] || 0)} 
                (${total > 0 ? ((categoryTotals['맑은이러닝'] || 0) / total * 100).toFixed(1) : 0}%)
            </div>
            <div style="margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 5px;">
                <strong style="color: #667eea;">콘텐츠:</strong> ${formatCurrency(categoryTotals['콘텐츠'] || 0)} 
                (${total > 0 ? ((categoryTotals['콘텐츠'] || 0) / total * 100).toFixed(1) : 0}%)
            </div>
            <div style="margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 5px;">
                <strong style="color: #667eea;">위캔디오:</strong> ${formatCurrency(categoryTotals['위캔디오'] || 0)} 
                (${total > 0 ? ((categoryTotals['위캔디오'] || 0) / total * 100).toFixed(1) : 0}%)
            </div>
            <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 18px; font-weight: bold; text-align: center;">
                합계: ${formatCurrency(total)}
            </div>
        </div>
        
        ${generateWeeklyTableHTML(monthData)}
        
        ${reportText ? `
        <div style="margin-top: 30px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">보고 내용</h3>
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
                ${reportText.replace(/\n/g, '<br>')}
            </div>
        </div>
        ` : ''}
    `;
    
    document.body.appendChild(pdfContainer);
    
    try {
        // html2canvas로 이미지 생성
        const canvas = await html2canvas(pdfContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        // jsPDF로 PDF 생성
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`매출통계_${currentYear}년${currentMonth}월.pdf`);
        
        document.body.removeChild(pdfContainer);
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        alert('PDF 생성 중 오류가 발생했습니다: ' + error.message);
        if (document.body.contains(pdfContainer)) {
            document.body.removeChild(pdfContainer);
        }
    }
}

// 주차별 테이블 HTML 생성
function generateWeeklyTableHTML(monthData) {
    const weeklyData = calculateWeeklyData(monthData);
    const weeks = Object.keys(weeklyData).sort((a, b) => a - b);
    
    if (weeks.length === 0) return '';
    
    let tableHTML = `
        <div style="margin-top: 30px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">주차별 상세 내역</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background: #667eea; color: white;">
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">주차</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">맑은이러닝</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">콘텐츠</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">위캔디오</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">합계</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    weeks.forEach(week => {
        const weekData = weeklyData[week];
        const weekTotal = (weekData['맑은이러닝'] || 0) + (weekData['콘텐츠'] || 0) + (weekData['위캔디오'] || 0);
        tableHTML += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${week}주차</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${formatCurrency(weekData['맑은이러닝'] || 0)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${formatCurrency(weekData['콘텐츠'] || 0)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${formatCurrency(weekData['위캔디오'] || 0)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${formatCurrency(weekTotal)}</strong></td>
                    </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return tableHTML;
}

// Base64 디코딩 (한글 지원)
function decodeBase64(str) {
    try {
        // Base64 디코딩 후 UTF-8로 변환
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        // 실패 시 decodeURIComponent 시도
        try {
            return decodeURIComponent(str);
        } catch (e2) {
            throw new Error('데이터 디코딩 실패');
        }
    }
}

// URL 파라미터에서 데이터 로드
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
        try {
            // Base64 디코딩
            const decoded = decodeBase64(dataParam);
            const data = JSON.parse(decoded);
            
            if (data.currentMonth && data.currentYear) {
                currentMonth = data.currentMonth;
                currentYear = data.currentYear;
                updateMonthDisplay();
            }
            
            if (data.reportText) {
                const reportTextArea = document.getElementById('reportText');
                if (reportTextArea) {
                    reportTextArea.value = data.reportText;
                }
            }
            
            // salesData가 있으면 로드
            if (data.salesData && Array.isArray(data.salesData)) {
                // 날짜 문자열을 Date 객체로 변환
                const loadedData = data.salesData.map(item => {
                    const date = new Date(item.date);
                    return {
                        date: date,
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        week: getWeekOfMonth(date),
                        company: item.itemName || item.company || '',
                        itemName: item.itemName || item.company || '',
                        category: item.category || '기타',
                        amount: item.amount || 0
                    };
                });
                
                // 기존 데이터에 추가 (같은 월 데이터가 있으면 교체)
                salesData = salesData.filter(d => 
                    !(d.year === currentYear && d.month === currentMonth)
                );
                salesData = salesData.concat(loadedData);
                
                updateDashboard();
            } else if (data.summary) {
                // 요약 정보만 있는 경우 (구버전 링크 호환성)
                const categoryTotals = {
                    '맑은이러닝': data.summary.맑은이러닝 || 0,
                    '콘텐츠': data.summary.콘텐츠 || 0,
                    '위캔디오': data.summary.위캔디오 || 0
                };
                
                // 요약 정보를 이용해 대시보드 업데이트 (데이터는 없지만 요약은 표시)
                const total = data.summary.합계 || 0;
                
                // 요약 정보 표시
                document.getElementById('currentMonthTotal').textContent = formatCurrency(total);
                updateSummaryCards(categoryTotals, total);
                
                // 주차별 테이블은 비우기
                document.getElementById('weeklyTableBody').innerHTML = 
                    '<tr><td colspan="5" class="no-data">상세 데이터가 포함되지 않은 링크입니다</td></tr>';
                
                alert(`${data.month} 매출 통계 요약 정보입니다.\n\n맑은이러닝: ${formatCurrency(data.summary.맑은이러닝)}\n콘텐츠: ${formatCurrency(data.summary.콘텐츠)}\n위캔디오: ${formatCurrency(data.summary.위캔디오)}\n합계: ${formatCurrency(data.summary.합계)}`);
            }
        } catch (e) {
            console.error('데이터 로드 오류:', e);
            alert('링크에서 데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }
});

