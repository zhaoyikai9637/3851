/**
 * Utility Functions for Profile Drawers (Personal Details, Summary, Language & Resumé)
 */

// 全球 200+ 国家和地区区号对应的合法手机号位数（纯数字）映射表
const COUNTRY_PHONE_LENGTHS = {
    '+93': [9],             // Afghanistan
    '+355': [9],            // Albania
    '+213': [9],            // Algeria
    '+1-684': [7, 10],      // American Samoa
    '+376': [6],            // Andorra
    '+244': [9],            // Angola
    '+1-264': [7, 10],      // Anguilla
    '+1-268': [7, 10],      // Antigua and Barbuda
    '+54': [10],            // Argentina
    '+374': [8],            // Armenia
    '+297': [7],            // Aruba
    '+61': [9],             // Australia
    '+43': [10, 11, 12, 13],// Austria
    '+994': [9],            // Azerbaijan
    '+1-242': [7, 10],      // Bahamas
    '+973': [8],            // Bahrain
    '+880': [10],           // Bangladesh
    '+1-246': [7, 10],      // Barbados
    '+375': [9],            // Belarus
    '+32': [9],             // Belgium
    '+501': [7],            // Belize
    '+229': [8],            // Benin
    '+1-441': [7, 10],      // Bermuda
    '+975': [8],            // Bhutan
    '+591': [8],            // Bolivia
    '+387': [8],            // Bosnia and Herzegovina
    '+267': [8],            // Botswana
    '+55': [10, 11],        // Brazil
    '+1-284': [7, 10],      // British Virgin Islands
    '+673': [7],            // Brunei
    '+359': [8, 9],         // Bulgaria
    '+226': [8],            // Burkina Faso
    '+257': [8],            // Burundi
    '+855': [8, 9],         // Cambodia
    '+237': [9],            // Cameroon
    '+1': [10],             // Canada / USA
    '+238': [7],            // Cape Verde
    '+1-345': [7, 10],      // Cayman Islands
    '+236': [8],            // Central African Republic
    '+235': [8],            // Chad
    '+56': [9],             // Chile
    '+86': [11],            // China
    '+57': [10],            // Colombia
    '+269': [7],            // Comoros
    '+243': [9],            // Congo (Democratic Republic)
    '+242': [9],            // Congo (Republic)
    '+682': [5],            // Cook Islands
    '+506': [8],            // Costa Rica
    '+225': [10],           // Cote d'Ivoire
    '+385': [8, 9],         // Croatia
    '+53': [8],             // Cuba
    '+357': [8],            // Cyprus
    '+420': [9],            // Czech Republic
    '+45': [8],             // Denmark
    '+253': [8],            // Djibouti
    '+1-767': [7, 10],      // Dominica
    '+1-809': [7, 10],      // Dominican Republic
    '+593': [9],            // Ecuador
    '+20': [10, 11],        // Egypt
    '+503': [8],            // El Salvador
    '+240': [9],            // Equatorial Guinea
    '+291': [7],            // Eritrea
    '+372': [7, 8],         // Estonia
    '+268': [8],            // Eswatini
    '+251': [9],            // Ethiopia
    '+679': [7],            // Fiji
    '+358': [9, 10],        // Finland
    '+33': [9],             // France
    '+594': [9],            // French Guiana
    '+689': [6],            // French Polynesia
    '+241': [7, 8],         // Gabon
    '+220': [7],            // Gambia
    '+995': [9],            // Georgia
    '+49': [10, 11],        // Germany
    '+233': [9],            // Ghana
    '+350': [8],            // Gibraltar
    '+30': [10],            // Greece
    '+299': [6],            // Greenland
    '+1-473': [7, 10],      // Grenada
    '+590': [9],            // Guadeloupe
    '+1-671': [7, 10],      // Guam
    '+502': [8],            // Guatemala
    '+224': [9],            // Guinea
    '+245': [9],            // Guinea-Bissau
    '+592': [7],            // Guyana
    '+509': [8],            // Haiti
    '+504': [8],            // Honduras
    '+852': [8],            // Hong Kong SAR
    '+36': [9],             // Hungary
    '+354': [7],            // Iceland
    '+91': [10],            // India
    '+62': [9, 10, 11, 12], // Indonesia
    '+98': [10],            // Iran
    '+964': [10],           // Iraq
    '+353': [9],            // Ireland
    '+972': [9],            // Israel
    '+39': [9, 10],         // Italy / Vatican City
    '+1-876': [7, 10],      // Jamaica
    '+81': [10],            // Japan
    '+962': [9],            // Jordan
    '+7': [10],             // Kazakhstan / Russia
    '+254': [9],            // Kenya
    '+686': [8],            // Kiribati
    '+383': [8],            // Kosovo
    '+965': [8],            // Kuwait
    '+996': [9],            // Kyrgyzstan
    '+856': [9, 10],        // Laos
    '+371': [8],            // Latvia
    '+961': [7, 8],         // Lebanon
    '+266': [8],            // Lesotho
    '+231': [7, 8],         // Liberia
    '+218': [9],            // Libya
    '+423': [7],            // Liechtenstein
    '+370': [8],            // Lithuania
    '+352': [9],            // Luxembourg
    '+853': [8],            // Macau SAR
    '+261': [9],            // Madagascar
    '+265': [9],            // Malawi
    '+60': [9, 10],         // Malaysia
    '+960': [7],            // Maldives
    '+223': [8],            // Mali
    '+356': [8],            // Malta
    '+692': [7],            // Marshall Islands
    '+596': [9],            // Martinique
    '+222': [8],            // Mauritania
    '+230': [8],            // Mauritius
    '+52': [10],            // Mexico
    '+691': [7],            // Micronesia
    '+373': [8],            // Moldova
    '+377': [8],            // Monaco
    '+976': [8],            // Mongolia
    '+382': [8],            // Montenegro
    '+1-664': [7, 10],      // Montserrat
    '+212': [9],            // Morocco
    '+258': [9],            // Mozambique
    '+95': [8, 9, 10],      // Myanmar
    '+264': [8, 9],         // Namibia
    '+674': [7],            // Nauru
    '+977': [10],           // Nepal
    '+31': [9],             // Netherlands
    '+687': [6],            // New Caledonia
    '+64': [8, 9, 10],      // New Zealand
    '+505': [8],            // Nicaragua
    '+227': [8],            // Niger
    '+234': [10],           // Nigeria
    '+850': [8, 9, 10],     // North Korea
    '+389': [8],            // North Macedonia
    '+47': [8],             // Norway
    '+968': [8],            // Oman
    '+92': [10],            // Pakistan
    '+680': [7],            // Palau
    '+970': [9],            // Palestine
    '+507': [8],            // Panama
    '+675': [8],            // Papua New Guinea
    '+595': [9],            // Paraguay
    '+51': [9],             // Peru
    '+63': [10],            // Philippines
    '+48': [9],             // Poland
    '+351': [9],            // Portugal
    '+1-787': [7, 10],      // Puerto Rico
    '+974': [8],            // Qatar
    '+40': [9],             // Romania
    '+250': [9],            // Rwanda
    '+685': [7],            // Samoa
    '+378': [8, 9, 10],     // San Marino
    '+966': [9],            // Saudi Arabia
    '+221': [9],            // Senegal
    '+381': [8, 9],         // Serbia
    '+248': [7],            // Seychelles
    '+232': [8],            // Sierra Leone
    '+65': [8],             // Singapore
    '+421': [9],            // Slovakia
    '+386': [8],            // Slovenia
    '+677': [7],            // Solomon Islands
    '+252': [8, 9],         // Somalia
    '+27': [9],             // South Africa
    '+82': [9, 10],         // South Korea
    '+211': [9],            // South Sudan
    '+34': [9],             // Spain
    '+94': [9],             // Sri Lanka
    '+249': [9],            // Sudan
    '+597': [7],            // Suriname
    '+46': [9],             // Sweden
    '+41': [9],             // Switzerland
    '+963': [9],            // Syria
    '+886': [9],            // Taiwan
    '+992': [9],            // Tajikistan
    '+255': [9],            // Tanzania
    '+66': [9],             // Thailand
    '+670': [7, 8],         // Timor-Leste
    '+228': [8],            // Togo
    '+676': [5, 7],         // Tonga
    '+1-868': [7, 10],      // Trinidad and Tobago
    '+216': [8],            // Tunisia
    '+90': [10],            // Turkey
    '+993': [8],            // Turkmenistan
    '+688': [5, 6],         // Tuvalu
    '+256': [9],            // Uganda
    '+380': [9],            // Ukraine
    '+971': [9],            // United Arab Emirates
    '+44': [10],            // United Kingdom
    '+598': [8],            // Uruguay
    '+998': [9],            // Uzbekistan
    '+678': [7],            // Vanuatu
    '+58': [10],            // Venezuela
    '+84': [9],             // Vietnam
    '+967': [9],            // Yemen
    '+260': [9],            // Zambia
    '+263': [9]             // Zimbabwe
};

/**
 * 根据所选国家区号校验输入的手机号长度
 */
function validatePhoneNumberLength(countryCode, phoneNumber) {
    const cleanNumber = (phoneNumber || '').replace(/\D/g, ''); // 过滤非数字字符
    if (!cleanNumber) {
        return { valid: true }; // 为空时不提示错误（若需要必填可在提交时增强）
    }

    const allowedLengths = COUNTRY_PHONE_LENGTHS[countryCode] || [7, 8, 9, 10, 11, 12, 13, 14, 15];
    const isValid = allowedLengths.includes(cleanNumber.length);

    if (!isValid) {
        if (allowedLengths.length === 1) {
            return {
                valid: false,
                error: `Phone number for ${countryCode} must be ${allowedLengths[0]} digits.`
            };
        } else {
            const min = allowedLengths[0];
            const max = allowedLengths[allowedLengths.length - 1];
            return {
                valid: false,
                error: `Phone number for ${countryCode} must be ${min}-${max} digits.`
            };
        }
    }

    return { valid: true };
}

/**
 * 校验个人简介输入
 */
function validateSummaryInput(text) {
    if (!text || text.trim() === '') {
        return { valid: false, error: 'Summary content cannot be empty.' };
    }
    return { valid: true };
}

/**
 * 校验语言输入
 */
function validateLanguageInput(reading, writing) {
    if (!reading && !writing) {
        return { valid: false, error: 'Please enter at least one language for reading or writing.' };
    }
    return { valid: true };
}

/**
 * 校验简历上传文件格式与大小
 */
function validateResumeFile(file) {
    if (!file) {
        return { valid: false, error: 'No file selected.' };
    }

    const allowedExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
    const fileName = file.name || '';
    const ext = fileName.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Allowed: doc, docx, pdf, txt, rtf.' };
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
        return { valid: false, error: 'File size exceeds the 5MB limit.' };
    }

    return { valid: true };
}

// 兼容 Node.js / Jest 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COUNTRY_PHONE_LENGTHS,
        validatePhoneNumberLength,
        validateSummaryInput,
        validateLanguageInput,
        validateResumeFile
    };
}