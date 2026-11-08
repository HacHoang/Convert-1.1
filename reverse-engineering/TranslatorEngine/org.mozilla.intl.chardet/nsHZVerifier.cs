namespace org.mozilla.intl.chardet;

public class nsHZVerifier : nsVerifier
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

	public nsHZVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 1;
		m_cclass[1] = 0;
		m_cclass[2] = 0;
		m_cclass[3] = 4096;
		m_cclass[4] = 0;
		m_cclass[5] = 0;
		m_cclass[6] = 0;
		m_cclass[7] = 0;
		m_cclass[8] = 0;
		m_cclass[9] = 0;
		m_cclass[10] = 0;
		m_cclass[11] = 0;
		m_cclass[12] = 0;
		m_cclass[13] = 0;
		m_cclass[14] = 0;
		m_cclass[15] = 38813696;
		m_cclass[16] = 286331153;
		m_cclass[17] = 286331153;
		m_cclass[18] = 286331153;
		m_cclass[19] = 286331153;
		m_cclass[20] = 286331153;
		m_cclass[21] = 286331153;
		m_cclass[22] = 286331153;
		m_cclass[23] = 286331153;
		m_cclass[24] = 286331153;
		m_cclass[25] = 286331153;
		m_cclass[26] = 286331153;
		m_cclass[27] = 286331153;
		m_cclass[28] = 286331153;
		m_cclass[29] = 286331153;
		m_cclass[30] = 286331153;
		m_cclass[31] = 286331153;
		m_states = new int[6];
		m_states[0] = 285213456;
		m_states[1] = 572657937;
		m_states[2] = 335548706;
		m_states[3] = 341120533;
		m_states[4] = 336872468;
		m_states[5] = 36;
		m_charset = "HZ-GB-2312";
		m_stFactor = 6;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
