namespace org.mozilla.intl.chardet;

public class nsUCS2BEVerifier : nsVerifier
{
	private static int[] m_cclass;

	private static int[] m_states;

	private static int m_stFactor;

	private static string m_charset;

	public override int[] cclass()
	{
		return m_cclass;
	}

	public override int[] states()
	{
		return m_states;
	}

	public override int stFactor()
	{
		return m_stFactor;
	}

	public override string charset()
	{
		return m_charset;
	}

	public nsUCS2BEVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 0;
		m_cclass[1] = 2097408;
		m_cclass[2] = 0;
		m_cclass[3] = 12288;
		m_cclass[4] = 0;
		m_cclass[5] = 3355440;
		m_cclass[6] = 0;
		m_cclass[7] = 0;
		m_cclass[8] = 0;
		m_cclass[9] = 0;
		m_cclass[10] = 0;
		m_cclass[11] = 0;
		m_cclass[12] = 0;
		m_cclass[13] = 0;
		m_cclass[14] = 0;
		m_cclass[15] = 0;
		m_cclass[16] = 0;
		m_cclass[17] = 0;
		m_cclass[18] = 0;
		m_cclass[19] = 0;
		m_cclass[20] = 0;
		m_cclass[21] = 0;
		m_cclass[22] = 0;
		m_cclass[23] = 0;
		m_cclass[24] = 0;
		m_cclass[25] = 0;
		m_cclass[26] = 0;
		m_cclass[27] = 0;
		m_cclass[28] = 0;
		m_cclass[29] = 0;
		m_cclass[30] = 0;
		m_cclass[31] = 1409286144;
		m_states = new int[7];
		m_states[0] = 288626549;
		m_states[1] = 572657937;
		m_states[2] = 291923490;
		m_states[3] = 1713792614;
		m_states[4] = 393569894;
		m_states[5] = 1717659269;
		m_states[6] = 1140326;
		m_charset = "UTF-16BE";
		m_stFactor = 6;
	}

	public override bool isUCS2()
	{
		return true;
	}
}
