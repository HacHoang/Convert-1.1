namespace org.mozilla.intl.chardet;

public class nsISO2022JPVerifier : nsVerifier
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

	public nsISO2022JPVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 2;
		m_cclass[1] = 570425344;
		m_cclass[2] = 0;
		m_cclass[3] = 4096;
		m_cclass[4] = 458752;
		m_cclass[5] = 3;
		m_cclass[6] = 0;
		m_cclass[7] = 0;
		m_cclass[8] = 1030;
		m_cclass[9] = 1280;
		m_cclass[10] = 0;
		m_cclass[11] = 0;
		m_cclass[12] = 0;
		m_cclass[13] = 0;
		m_cclass[14] = 0;
		m_cclass[15] = 0;
		m_cclass[16] = 572662306;
		m_cclass[17] = 572662306;
		m_cclass[18] = 572662306;
		m_cclass[19] = 572662306;
		m_cclass[20] = 572662306;
		m_cclass[21] = 572662306;
		m_cclass[22] = 572662306;
		m_cclass[23] = 572662306;
		m_cclass[24] = 572662306;
		m_cclass[25] = 572662306;
		m_cclass[26] = 572662306;
		m_cclass[27] = 572662306;
		m_cclass[28] = 572662306;
		m_cclass[29] = 572662306;
		m_cclass[30] = 572662306;
		m_cclass[31] = 572662306;
		m_states = new int[6];
		m_states[0] = 304;
		m_states[1] = 286331153;
		m_states[2] = 572662306;
		m_states[3] = 1091653905;
		m_states[4] = 303173905;
		m_states[5] = 287445265;
		m_charset = "ISO-2022-JP";
		m_stFactor = 8;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
