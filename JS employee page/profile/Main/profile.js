document.addEventListener('DOMContentLoaded', () => {
    // 1. 模拟从数据库/localStorage 加载的 Profile 数据
    const userProfile = {
        first_name: 'Alex',
        last_name: 'Tan',
        email: localStorage.getItem('user_email') || 'alex.tan@example.com',
        contact_number: '91234567',
        country_code: '+65'
    };

    // 2. 渲染基础个人信息
    const fullName = `${userProfile.first_name} ${userProfile.last_name}`;
    document.getElementById('userName').textContent = fullName;
    document.getElementById('userEmail').textContent = userProfile.email;
    document.getElementById('userPhone').textContent = formatPhoneNumber(userProfile.country_code, userProfile.contact_number);
    document.getElementById('avatarCircle').textContent = getInitials(fullName);

    // 3. 抽屉弹窗通用控制逻辑 (Open / Close Drawer)
    const backdrop = document.getElementById('drawerBackdrop');
    const drawers = document.querySelectorAll('.drawer');

    function openDrawer(drawerId) {
        const targetDrawer = document.getElementById(drawerId);
        if (targetDrawer && backdrop) {
            targetDrawer.classList.add('open');
            backdrop.style.display = 'block';
        }
    }

    function closeAllDrawers() {
        drawers.forEach(drawer => drawer.classList.remove('open'));
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeAllDrawers);
    }

    // --- 1) Editing Materials Drawer ---
    document.getElementById('editMaterialsBtn').addEventListener('click', () => {
        document.getElementById('editFirstName').value = userProfile.first_name;
        document.getElementById('editLastName').value = userProfile.last_name;
        document.getElementById('editContactNumber').value = userProfile.contact_number;
        document.getElementById('editEmailAddress').value = userProfile.email;
        openDrawer('materialsDrawer');
    });
    document.getElementById('closeMaterialsBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelMaterialsBtn').addEventListener('click', closeAllDrawers);

    // --- 2) Add Personal Summary Drawer ---
    document.getElementById('addSummaryBtn').addEventListener('click', () => {
        openDrawer('summaryDrawer');
    });
    document.getElementById('closeSummaryBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelSummaryBtn').addEventListener('click', closeAllDrawers);

    // --- 3) Add Career Role Drawer ---
    document.getElementById('addRoleBtn').addEventListener('click', () => {
        openDrawer('roleDrawer');
    });
    document.getElementById('closeRoleBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelRoleBtn').addEventListener('click', closeAllDrawers);

    // --- 4) Add Education Drawer (动态字段切换) ---
    const eduCompleteCheckbox = document.getElementById('eduComplete');
    const finishedGroup = document.getElementById('finishedFieldGroup');
    const expectedGroup = document.getElementById('expectedFinishFieldGroup');

    if (eduCompleteCheckbox) {
        eduCompleteCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                finishedGroup.style.display = 'block';
                expectedGroup.style.display = 'none';
            } else {
                finishedGroup.style.display = 'none';
                expectedGroup.style.display = 'block';
            }
        });
    }

    document.getElementById('addEducationBtn').addEventListener('click', () => {
        openDrawer('educationDrawer');
    });
    document.getElementById('closeEducationBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelEducationBtn').addEventListener('click', closeAllDrawers);

    // --- 5) Add Licence or Certification Drawer (动态 Expiry 切换) ---
    const certNoExpiryCheckbox = document.getElementById('certNoExpiry');
    const expiryLabel = document.getElementById('expiryLabel');
    const certExpiryMonth = document.getElementById('certExpiryMonth');
    const certExpiryYear = document.getElementById('certExpiryYear');

    if (certNoExpiryCheckbox) {
        certNoExpiryCheckbox.addEventListener('change', (e) => {
            const isNoExpiry = e.target.checked;
            expiryLabel.style.display = isNoExpiry ? 'none' : 'block';
            certExpiryMonth.style.display = isNoExpiry ? 'none' : 'block';
            certExpiryYear.style.display = isNoExpiry ? 'none' : 'block';
        });
    }

    document.getElementById('addCertBtn').addEventListener('click', () => {
        openDrawer('licenceDrawer');
    });
    document.getElementById('closeLicenceBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelLicenceBtn').addEventListener('click', closeAllDrawers);

    // --- 6) Add Skills Drawer (动态技能 Chip 列表) ---
    let currentSkills = [];
    const skillInput = document.getElementById('skillInput');
    const addSkillTagBtn = document.getElementById('addSkillTagBtn');
    const addedSkillsContainer = document.getElementById('addedSkillsContainer');

    function renderSkillsUI() {
        addedSkillsContainer.innerHTML = '';
        if (currentSkills.length === 0) {
            addedSkillsContainer.innerHTML = '<span class="empty-skills-text">No skills have been added</span>';
            return;
        }

        currentSkills.forEach((skill, index) => {
            const chip = document.createElement('div');
            chip.className = 'skill-chip';
            chip.innerHTML = `
                <span>${skill}</span>
                <span class="remove-skill-btn" data-index="${index}">&times;</span>
            `;
            addedSkillsContainer.appendChild(chip);
        });

        document.querySelectorAll('.remove-skill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                currentSkills = removeSkill(currentSkills, idx);
                renderSkillsUI();
            });
        });
    }

    function handleAddSkill() {
        const val = skillInput.value.trim();
        const result = addSkill(currentSkills, val);
        if (result.success) {
            currentSkills = result.updatedSkills;
            skillInput.value = '';
            renderSkillsUI();
        } else if (result.error) {
            alert(result.error);
        }
    }

    if (addSkillTagBtn) addSkillTagBtn.addEventListener('click', handleAddSkill);
    if (skillInput) {
        skillInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSkill();
            }
        });
    }

    document.getElementById('addSkillBtn').addEventListener('click', () => {
        renderSkillsUI();
        openDrawer('skillsDrawer');
    });
    document.getElementById('closeSkillsBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelSkillsBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('saveSkillsBtn').addEventListener('click', () => {
        const skillTagsMain = document.getElementById('skillTags');
        if (skillTagsMain) {
            skillTagsMain.innerHTML = currentSkills.map(s => `<span class="skill-chip">${s}</span>`).join(' ');
        }
        closeAllDrawers();
    });

    // --- 7) Add Language Drawer (新增) ---
    const languageForm = document.getElementById('languageForm');
    document.getElementById('addLanguageBtn').addEventListener('click', () => {
        openDrawer('languageDrawer');
    });
    document.getElementById('closeLanguageBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelLanguageBtn').addEventListener('click', closeAllDrawers);

    if (languageForm) {
        languageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reading = document.getElementById('langReading').value.trim();
            const writing = document.getElementById('langWriting').value.trim();

            const validation = validateLanguageInput(reading, writing);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            const langContainer = document.getElementById('languageList');
            if (langContainer) {
                langContainer.innerHTML = `<p><strong>Reading:</strong> ${reading || 'None'}</p><p><strong>Writing:</strong> ${writing || 'None'}</p>`;
            }
            closeAllDrawers();
        });
    }

    // --- 8) Add Resumé Drawer (拖拽 & 文件上传新增) ---
    const resumeFileInput = document.getElementById('resumeFileInput');
    const browseResumeBtn = document.getElementById('browseResumeBtn');
    const resumeDropzone = document.getElementById('resumeDropzone');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const resumeError = document.getElementById('resumeError');
    const resumeForm = document.getElementById('resumeForm');
    let selectedFile = null;

    document.getElementById('addResumeBtn').addEventListener('click', () => {
        openDrawer('resumeDrawer');
    });
    document.getElementById('closeResumeBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelResumeBtn').addEventListener('click', closeAllDrawers);

    if (browseResumeBtn) {
        browseResumeBtn.addEventListener('click', () => resumeFileInput.click());
    }

    function handleFileSelection(file) {
        resumeError.textContent = '';
        const checkResult = validateResumeFile(file);
        if (!checkResult.valid) {
            resumeError.textContent = checkResult.error;
            selectedFile = null;
            selectedFileInfo.style.display = 'none';
            return;
        }

        selectedFile = file;
        selectedFileInfo.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        selectedFileInfo.style.display = 'block';
    }

    if (resumeFileInput) {
        resumeFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelection(e.target.files[0]);
            }
        });
    }

    // Dropzone 拖拽效果支持
    if (resumeDropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            resumeDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                resumeDropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            resumeDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                resumeDropzone.classList.remove('dragover');
            });
        });

        resumeDropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt.files && dt.files[0]) {
                handleFileSelection(dt.files[0]);
            }
        });
    }

    if (resumeForm) {
        resumeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!selectedFile) {
                resumeError.textContent = 'Please select or drop a resumé file before saving.';
                return;
            }

            const resumeListContainer = document.getElementById('resumeList');
            if (resumeListContainer) {
                resumeListContainer.innerHTML = `<p><i class="fa-regular fa-file-pdf"></i> ${selectedFile.name}</p>`;
            }
            closeAllDrawers();
        });
    }
});