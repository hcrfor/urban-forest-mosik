import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// DOM Elements
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const settingsDetails = document.getElementById('settings-details');
const apiHelpText = document.getElementById('api-help-text');

const imageUpload = document.getElementById('image-upload');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = analyzeBtn.querySelector('.btn-text');
const spinner = analyzeBtn.querySelector('.spinner');

const resultSection = document.getElementById('result-section');
const resultBody = document.getElementById('result-body');
const totalPercentageEl = document.getElementById('total-percentage');
const downloadResultBtn = document.getElementById('download-result-btn');
const resetBtn = document.getElementById('reset-btn');

// Constants
const STORAGE_KEY = 'gemini_api_key';

// *** 1. 설정 및 API Key 관리 ***
function updateApiUiState(isSaved) {
    if (isSaved) {
        saveApiKeyBtn.textContent = '저장 완료';
        saveApiKeyBtn.classList.add('saved'); // Optional styling hook
        saveApiKeyBtn.style.backgroundColor = '#2D5A27'; // Visual feedback
        saveApiKeyBtn.style.color = '#ffffff';
        if (apiHelpText) apiHelpText.classList.remove('hidden');
    } else {
        saveApiKeyBtn.textContent = '저장하기';
        saveApiKeyBtn.classList.remove('saved');
        saveApiKeyBtn.style.backgroundColor = '';
        saveApiKeyBtn.style.color = '';
        if (apiHelpText) apiHelpText.classList.add('hidden');
    }
}

function loadApiKey() {
    const key = localStorage.getItem(STORAGE_KEY);
    if (key) {
        apiKeyInput.value = key;
        updateApiUiState(true);
        // Note: We keep settings open or closed based on user preference? 
        // User flow doc says: "Initialization: User opens the app. If no API key is found... '저장하기' is active."
        // If found, we assume it's saved.
        settingsDetails.open = false;
    } else {
        updateApiUiState(false);
        settingsDetails.open = true;
    }
}

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem(STORAGE_KEY, key);
        updateApiUiState(true);
        // Do not auto-close details immediately, let user see the "Saved" state and the help message per requirement
        // "Dynamic Help Text ... appears below"
    } else {
        alert('유효한 API Key를 입력해주세요.');
    }
});

// Input Revalidation: Revert to "Save" button if user modifies key
apiKeyInput.addEventListener('input', () => {
    updateApiUiState(false);
});

// *** 2. 이미지 업로드 및 미리보기 ***
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewContainer.classList.remove('hidden');
        analyzeBtn.disabled = false;
        resultSection.classList.add('hidden'); // 새 이미지 올리면 결과 숨기기
    };
    reader.readAsDataURL(file);
});

// *** 3. Gemini AI 분석 요청 ***
analyzeBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem(STORAGE_KEY);
    if (!apiKey) {
        alert('분석을 시작하려면 먼저 설정에서 Google Gemini API Key를 저장해주세요.');
        settingsDetails.open = true;
        return;
    }

    // UI 상태 변경
    setLoading(true);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imageBase64 = imagePreview.src.split(',')[1];

        const prompt = `
        당신은 도시 산림 전문가입니다. 첨부된 이미지는 손으로 그린 '도시산림 개황모식도'입니다. 
        이 원형 플롯 안에 있는 텍스트 라벨들을 식별하고, 각 영역의 비율(%)을 시각적으로 추정해주세요.

        **중요 규칙:**
        1. **지피식생(Ground Cover)만 식별하세요.** (예: 잔디, 토끼풀, 나대지, 포장 등).
        2. **수목명(Tree names)은 무시하세요.** (예: 소나무, 벚나무, 회양목, 영산홍 등 나무 이름은 비율 계산에서 제외하고, 해당 영역의 바닥 식생으로 간주하세요).
        3. 모든 비율은 **5% 단위**로 반올림하세요.
        4. 모든 항목의 합계는 **정확히 100%**가 되어야 합니다.
        5. 응답은 오직 다음 JSON 형식으로만 주세요:
        [
            {"name": "항목명1", "percentage": 50},
            {"name": "항목명2", "percentage": 30},
            {"name": "항목명3", "percentage": 20}
        ]
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // JSON 파싱 (마크다운 코드 블록 제거)
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);

        renderResults(data);

    } catch (error) {
        console.error(error);
        alert(`분석 중 오류가 발생했습니다: ${error.message}\n\nAPI 키를 확인하거나 이미지를 다시 확인해주세요.`);
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    if (isLoading) {
        analyzeBtn.disabled = true;
        btnText.textContent = '분석 중...';
        spinner.classList.remove('hidden');
    } else {
        analyzeBtn.disabled = false;
        btnText.textContent = '분석하기';
        spinner.classList.add('hidden');
    }
}

// *** 4. 결과 렌더링 및 수정 ***
function renderResults(data) {
    resultBody.innerHTML = '';
    let total = 0;

    data.forEach((item, index) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameCell.appendChild(nameInput);

        const percentCell = document.createElement('td');
        percentCell.textContent = `${item.percentage}%`;

        row.appendChild(nameCell);
        row.appendChild(percentCell);
        resultBody.appendChild(row);

        total += item.percentage;
    });

    totalPercentageEl.textContent = `${total}%`;

    if (total !== 100) {
        totalPercentageEl.style.color = '#CF6679'; // 경고 색상
    } else {
        totalPercentageEl.style.color = '#4A7C43'; // 정상 색상
    }

    resultSection.classList.remove('hidden');

    // 결과 섹션으로 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// *** 5. 결과 이미지 생성 및 저장 (Canvas API) ***
downloadResultBtn.addEventListener('click', async () => {
    if (!imagePreview.src) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // 이미지 로딩 대기
    await new Promise(resolve => {
        img.onload = resolve;
        img.src = imagePreview.src;
    });

    // 캔버스 크기 설정 (원본 이미지 너비 기준 + 여백)
    const padding = 40;
    const headerHeight = 100;
    const rowHeight = 60;
    const footerHeight = 80;

    // 테이블 데이터 수집
    const rows = [];
    const trs = resultBody.querySelectorAll('tr');
    trs.forEach(tr => {
        const name = tr.querySelector('input').value;
        const percent = tr.querySelector('td:last-child').textContent;
        rows.push({ name, percent });
    });

    const tableHeight = (rows.length + 1) * rowHeight + footerHeight; // +1 for header
    const totalHeight = img.height + tableHeight + (padding * 3);

    canvas.width = Math.max(img.width, 800); // 최소 너비 800
    canvas.height = totalHeight;

    // 배경색 채우기
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. 원본 이미지 그리기
    // 이미지를 중앙 정렬
    const imgX = (canvas.width - img.width) / 2;
    ctx.drawImage(img, imgX, padding);

    // 2. 제목 그리기
    ctx.fillStyle = '#2D5A27';
    ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('도시산림 개황모식도 분석 결과', canvas.width / 2, img.height + padding + 60);

    // 3. 테이블 그리기 시작 위치
    let currentY = img.height + padding + headerHeight;
    const tableWidth = canvas.width - (padding * 2);
    const col1X = padding + 20;
    const col2X = canvas.width - padding - 20;

    // 테이블 헤더
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(padding, currentY, tableWidth, rowHeight);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('항목명', col1X, currentY + 40);
    ctx.textAlign = 'right';
    ctx.fillText('비율 (%)', col2X, currentY + 40);

    currentY += rowHeight;

    // 테이블 내용
    ctx.font = '24px "Noto Sans KR", sans-serif';
    rows.forEach((row, index) => {
        // 줄무늬 효과
        if (index % 2 === 1) {
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(padding, currentY, tableWidth, rowHeight);
        }

        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        ctx.fillText(row.name, col1X, currentY + 40);
        ctx.textAlign = 'right';
        ctx.fillText(row.percent, col2X, currentY + 40);

        // 구분선
        ctx.beginPath();
        ctx.strokeStyle = '#e0e0e0';
        ctx.moveTo(padding, currentY + rowHeight);
        ctx.lineTo(canvas.width - padding, currentY + rowHeight);
        ctx.stroke();

        currentY += rowHeight;
    });

    // 합계
    ctx.fillStyle = '#2D5A27';
    ctx.fillRect(padding, currentY, tableWidth, rowHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('합계', col1X, currentY + 40);
    ctx.textAlign = 'right';
    ctx.fillText('100%', col2X, currentY + 40);

    // 4. 이미지 다운로드 트리거
    const link = document.createElement('a');
    link.download = `analysis_result_${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
});

// *** 6. 초기화 ***
resetBtn.addEventListener('click', () => {
    imageUpload.value = '';
    previewContainer.classList.add('hidden');
    resultSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 초기 실행
loadApiKey();
