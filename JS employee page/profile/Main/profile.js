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

    window.openDrawer = function(drawerId) {
        const targetDrawer = document.getElementById(drawerId);
        if (targetDrawer && backdrop) {
            targetDrawer.classList.add('open');
            backdrop.style.display = 'block';
        }
    };

    function closeAllDrawers() {
        drawers.forEach(drawer => drawer.classList.remove('open'));
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeAllDrawers);
    }

    // --- 1) Editing Materials Drawer (含区号与手机位数校验) ---
    const materialsForm = document.getElementById('materialsForm');
    const countryCodeSelect = document.getElementById('editCountryCode');
    const phonePrefixText = document.getElementById('phonePrefixText');
    const editContactInput = document.getElementById('editContactNumber');
    const phoneInputWrapper = document.getElementById('phoneInputWrapper');
    const phoneError = document.getElementById('phoneError');

    function checkPhoneValidation() {
        const code = countryCodeSelect ? countryCodeSelect.value : '+65';
        const num = editContactInput ? editContactInput.value.trim() : '';

        if (!num) {
            if (phoneError) phoneError.textContent = '';
            if (phoneInputWrapper) phoneInputWrapper.classList.remove('input-error');
            return true;
        }

        if (typeof validatePhoneNumberLength === 'function') {
            const res = validatePhoneNumberLength(code, num);
            if (!res.valid) {
                if (phoneError) phoneError.textContent = res.error;
                if (phoneInputWrapper) phoneInputWrapper.classList.add('input-error');
                return false;
            }
        }

        if (phoneError) phoneError.textContent = '';
        if (phoneInputWrapper) phoneInputWrapper.classList.remove('input-error');
        return true;
    }

    document.getElementById('editMaterialsBtn').addEventListener('click', () => {
        document.getElementById('editFirstName').value = userProfile.first_name;
        document.getElementById('editLastName').value = userProfile.last_name;
        document.getElementById('editContactNumber').value = userProfile.contact_number;
        document.getElementById('editEmailAddress').value = userProfile.email;
        if (countryCodeSelect) countryCodeSelect.value = userProfile.country_code;
        if (phonePrefixText) phonePrefixText.textContent = userProfile.country_code;
        checkPhoneValidation();
        openDrawer('materialsDrawer');
    });

    document.getElementById('closeMaterialsBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelMaterialsBtn').addEventListener('click', closeAllDrawers);

    if (editContactInput) {
        editContactInput.addEventListener('input', checkPhoneValidation);
    }

    if (countryCodeSelect && phonePrefixText) {
        countryCodeSelect.addEventListener('change', (e) => {
            phonePrefixText.textContent = e.target.value;
            checkPhoneValidation();
        });
    }

    if (materialsForm) {
        materialsForm.addEventListener('submit', (e) => {
            e.preventDefault();

            if (!checkPhoneValidation()) {
                return;
            }

            userProfile.first_name = document.getElementById('editFirstName').value.trim();
            userProfile.last_name = document.getElementById('editLastName').value.trim();
            userProfile.country_code = countryCodeSelect ? countryCodeSelect.value : '+65';
            userProfile.contact_number = editContactInput.value.trim();

            const updatedFullName = `${userProfile.first_name} ${userProfile.last_name}`;
            document.getElementById('userName').textContent = updatedFullName;
            document.getElementById('userPhone').textContent = formatPhoneNumber(userProfile.country_code, userProfile.contact_number);
            document.getElementById('avatarCircle').textContent = getInitials(updatedFullName);
            closeAllDrawers();
        });
    }

    // --- 2) Add Personal Summary Drawer ---
    const summaryForm = document.getElementById('summaryForm');
    document.getElementById('addSummaryBtn').addEventListener('click', () => openDrawer('summaryDrawer'));
    document.getElementById('closeSummaryBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelSummaryBtn').addEventListener('click', closeAllDrawers);

    if (summaryForm) {
        summaryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = document.getElementById('summaryInput').value.trim();

            if (typeof validateSummaryInput === 'function') {
                const validation = validateSummaryInput(text);
                if (!validation.valid) {
                    alert(validation.error);
                    return;
                }
            }

            const container = document.getElementById('summaryContent');
            container.innerHTML = `
                <div class="profile-card-item">
                    <button type="button" class="card-edit-btn" onclick="openDrawer('summaryDrawer')"><i class="fa-solid fa-pen"></i></button>
                    <div class="card-subtext">${text}</div>
                </div>
            `;
            document.getElementById('addSummaryBtn').style.display = 'none';
            closeAllDrawers();
        });
    }

    // --- 3) Add Career Role Drawer ---
    const roleForm = document.getElementById('roleForm');
    document.getElementById('addRoleBtn').addEventListener('click', () => openDrawer('roleDrawer'));
    document.getElementById('closeRoleBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelRoleBtn').addEventListener('click', closeAllDrawers);

    if (roleForm) {
        roleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('roleTitle').value.trim();
            const company = document.getElementById('roleCompany').value.trim();
            const startMonth = document.getElementById('roleStartMonth').value;
            const startYear = document.getElementById('roleStartYear').value.trim();
            const stillInRole = document.getElementById('roleStillInRole').checked;
            const endMonth = document.getElementById('roleEndMonth').value;
            const endYear = document.getElementById('roleEndYear').value.trim();

            const dateRange = stillInRole 
                ? `${startMonth} ${startYear} - Present`
                : `${startMonth} ${startYear} - ${endMonth} ${endYear}`;

            const container = document.getElementById('careerList');
            const cardHtml = `
                <div class="profile-card-item">
                    <button type="button" class="card-edit-btn" onclick="openDrawer('roleDrawer')"><i class="fa-solid fa-pen"></i></button>
                    <div class="card-title">${title}</div>
                    <div class="card-subtitle">${company} <a href="#" class="card-link">Review this company</a></div>
                    <div class="card-subtext">${dateRange}</div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
            roleForm.reset();
            closeAllDrawers();
        });
    }

    // --- 4) Add Education Drawer ---
    const eduCompleteCheckbox = document.getElementById('eduComplete');
    const finishedGroup = document.getElementById('finishedFieldGroup');
    const expectedGroup = document.getElementById('expectedFinishFieldGroup');
    const educationForm = document.getElementById('educationForm');

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

    document.getElementById('addEducationBtn').addEventListener('click', () => openDrawer('educationDrawer'));
    document.getElementById('closeEducationBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelEducationBtn').addEventListener('click', closeAllDrawers);

    if (educationForm) {
        educationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const course = document.getElementById('eduCourse').value.trim();
            const institution = document.getElementById('eduInstitution').value.trim();
            const isComplete = document.getElementById('eduComplete').checked;
            const finishedYear = document.getElementById('eduFinishedYear').value.trim();
            const expMonth = document.getElementById('eduExpectedMonth').value;
            const expYear = document.getElementById('eduExpectedYear').value.trim();

            const statusText = isComplete 
                ? `Finished ${finishedYear}` 
                : `Expected finish ${expMonth} ${expYear}`;

            const container = document.getElementById('educationList');
            const cardHtml = `
                <div class="profile-card-item">
                    <button type="button" class="card-edit-btn" onclick="openDrawer('educationDrawer')"><i class="fa-solid fa-pen"></i></button>
                    <div class="card-title">${course}</div>
                    <div class="card-subtitle">${institution}</div>
                    <div class="card-subtext">${statusText}</div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
            educationForm.reset();
            closeAllDrawers();
        });
    }

    // --- 5) Add Licence or Certification Drawer ---
    const certNoExpiryCheckbox = document.getElementById('certNoExpiry');
    const expiryLabel = document.getElementById('expiryLabel');
    const certExpiryMonth = document.getElementById('certExpiryMonth');
    const certExpiryYear = document.getElementById('certExpiryYear');
    const licenceForm = document.getElementById('licenceForm');

    if (certNoExpiryCheckbox) {
        certNoExpiryCheckbox.addEventListener('change', (e) => {
            const isNoExpiry = e.target.checked;
            expiryLabel.style.display = isNoExpiry ? 'none' : 'block';
            certExpiryMonth.style.display = isNoExpiry ? 'none' : 'block';
            certExpiryYear.style.display = isNoExpiry ? 'none' : 'block';
        });
    }

    document.getElementById('addCertBtn').addEventListener('click', () => openDrawer('licenceDrawer'));
    document.getElementById('closeLicenceBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelLicenceBtn').addEventListener('click', closeAllDrawers);

    if (licenceForm) {
        licenceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('certName').value.trim();
            const issuer = document.getElementById('certIssuer').value.trim();

            const container = document.getElementById('certList');
            const cardHtml = `
                <div class="profile-card-item">
                    <button type="button" class="card-edit-btn" onclick="openDrawer('licenceDrawer')"><i class="fa-solid fa-pen"></i></button>
                    <div class="card-title">${name}</div>
                    <div class="card-subtitle">${issuer || 'N/A'}</div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
            licenceForm.reset();
            closeAllDrawers();
        });
    }

    // --- 6) Add Skills Drawer ---
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
                if (typeof removeSkill === 'function') {
                    currentSkills = removeSkill(currentSkills, idx);
                } else {
                    currentSkills.splice(idx, 1);
                }
                renderSkillsUI();
            });
        });
    }

    function handleAddSkill() {
        const val = skillInput.value.trim();
        if (typeof addSkill === 'function') {
            const result = addSkill(currentSkills, val);
            if (result.success) {
                currentSkills = result.updatedSkills;
                skillInput.value = '';
                renderSkillsUI();
            } else if (result.error) {
                alert(result.error);
            }
        } else if (val) {
            currentSkills.push(val);
            skillInput.value = '';
            renderSkillsUI();
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

    // --- 7) Add Language Drawer ---
    const languageForm = document.getElementById('languageForm');
    document.getElementById('addLanguageBtn').addEventListener('click', () => openDrawer('languageDrawer'));
    document.getElementById('closeLanguageBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelLanguageBtn').addEventListener('click', closeAllDrawers);

    if (languageForm) {
        languageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reading = document.getElementById('langReading').value.trim();
            const writing = document.getElementById('langWriting').value.trim();

            if (typeof validateLanguageInput === 'function') {
                const validation = validateLanguageInput(reading, writing);
                if (!validation.valid) {
                    alert(validation.error);
                    return;
                }
            }

            const langContainer = document.getElementById('languageList');
            if (langContainer) {
                langContainer.innerHTML = `
                    <div class="profile-card-item">
                        <button type="button" class="card-edit-btn" onclick="openDrawer('languageDrawer')"><i class="fa-solid fa-pen"></i></button>
                        <div class="card-subtitle"><strong>Reading:</strong> ${reading || 'None'}</div>
                        <div class="card-subtitle"><strong>Writing:</strong> ${writing || 'None'}</div>
                    </div>
                `;
            }
            closeAllDrawers();
        });
    }

    // --- 8) Add Resumé Drawer ---
    const resumeFileInput = document.getElementById('resumeFileInput');
    const browseResumeBtn = document.getElementById('browseResumeBtn');
    const resumeDropzone = document.getElementById('resumeDropzone');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const resumeError = document.getElementById('resumeError');
    const resumeForm = document.getElementById('resumeForm');
    let selectedFile = null;

    document.getElementById('addResumeBtn').addEventListener('click', () => openDrawer('resumeDrawer'));
    document.getElementById('closeResumeBtn').addEventListener('click', closeAllDrawers);
    document.getElementById('cancelResumeBtn').addEventListener('click', closeAllDrawers);

    if (browseResumeBtn) {
        browseResumeBtn.addEventListener('click', () => resumeFileInput.click());
    }

    function handleFileSelection(file) {
        resumeError.textContent = '';
        if (typeof validateResumeFile === 'function') {
            const checkResult = validateResumeFile(file);
            if (!checkResult.valid) {
                resumeError.textContent = checkResult.error;
                selectedFile = null;
                selectedFileInfo.style.display = 'none';
                return;
            }
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
                resumeListContainer.innerHTML = `
                    <div class="profile-card-item">
                        <button type="button" class="card-edit-btn" onclick="openDrawer('resumeDrawer')"><i class="fa-solid fa-pen"></i></button>
                        <div class="card-title"><i class="fa-regular fa-file-pdf"></i> ${selectedFile.name}</div>
                    </div>
                `;
            }
            closeAllDrawers();
        });
    }
});