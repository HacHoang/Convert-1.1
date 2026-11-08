namespace org.mozilla.intl.chardet;

public class nsEUCJPVerifier : nsVerifier
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

	public nsEUCJPVerifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 1145324612;
		m_cclass[1] = 1430537284;
		m_cclass[2] = 1145324612;
		m_cclass[3] = 1145328708;
		m_cclass[4] = 1145324612;
		m_cclass[5] = 1145324612;
		m_cclass[6] = 1145324612;
		m_cclass[7] = 1145324612;
		m_cclass[8] = 1145324612;
		m_cclass[9] = 1145324612;
		m_cclass[10] = 1145324612;
		m_cclass[11] = 1145324612;
		m_cclass[12] = 1145324612;
		m_cclass[13] = 1145324612;
		m_cclass[14] = 1145324612;
		m_cclass[15] = 1145324612;
		m_cclass[16] = 1431655765;
		m_cclass[17] = 827675989;
		m_cclass[18] = 1431655765;
		m_cclass[19] = 1431655765;
		m_cclass[20] = 572662309;
		m_cclass[21] = 572662306;
		m_cclass[22] = 572662306;
		m_cclass[23] = 572662306;
		m_cclass[24] = 572662306;
		m_cclass[25] = 572662306;
		m_cclass[26] = 572662306;
		m_cclass[27] = 572662306;
		m_cclass[28] = 0;
		m_cclass[29] = 0;
		m_cclass[30] = 0;
		m_cclass[31] = 1342177280;
		m_states = new int[5];
		m_states[0] = 286282563;
		m_states[1] = 572657937;
		m_states[2] = 286265378;
		m_states[3] = 319885329;
		m_states[4] = 4371;
		m_charset = "EUC-JP";
		m_stFactor = 6;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
